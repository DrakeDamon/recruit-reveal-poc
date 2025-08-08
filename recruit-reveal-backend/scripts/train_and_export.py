#!/usr/bin/env python3
"""
Recruit Reveal Pipeline Training and Export Script

This script trains and exports position-specific ML pipelines with versioning support.
Designed to be run from the command line with explicit arguments.

Usage:
    python -m scripts.train_and_export --csv data/training.csv --position all --version 1.0.0
    python -m scripts.train_and_export --csv data/training.csv --position qb --version 1.1.0
"""

import argparse
import sys
import logging
import pandas as pd
from pathlib import Path
from typing import List, Dict, Any, Optional
import os

# Add parent directory to path to import the pipeline
sys.path.insert(0, str(Path(__file__).parent.parent))

from recruit_reveal_production_pipeline import (
    RecruitRevealPipeline, 
    PipelineConfig,
    ModelVersionError,
    DataValidationError,
    ModelTrainingError
)

# Configure logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def load_and_validate_data(csv_path: str) -> pd.DataFrame:
    """
    Load training data and perform basic validation
    
    Args:
        csv_path: Path to training CSV file
        
    Returns:
        Validated DataFrame
        
    Raises:
        FileNotFoundError: If CSV file doesn't exist
        DataValidationError: If data is invalid
    """
    logger.info(f"Loading training data from: {csv_path}")
    
    if not Path(csv_path).exists():
        raise FileNotFoundError(f"Training CSV not found: {csv_path}")
    
    try:
        df = pd.read_csv(csv_path)
        logger.info(f"Loaded {len(df)} rows from CSV")
        
        # Basic validation
        if len(df) == 0:
            raise DataValidationError("CSV file is empty")
        
        # Check for required columns
        required_cols = ['position', 'division']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise DataValidationError(f"Missing required columns: {missing_cols}")
        
        # Check position distribution
        pos_counts = df['position'].value_counts()
        logger.info(f"Position distribution: {pos_counts.to_dict()}")
        
        # Check division distribution
        div_counts = df['division'].value_counts()
        logger.info(f"Division distribution: {div_counts.to_dict()}")
        
        return df
        
    except pd.errors.EmptyDataError:
        raise DataValidationError("CSV file is empty or corrupted")
    except Exception as e:
        raise DataValidationError(f"Failed to load CSV: {str(e)}")

def filter_data_for_position(df: pd.DataFrame, position: str, min_samples: int = 30) -> pd.DataFrame:
    """
    Filter and validate data for a specific position
    
    Args:
        df: Full dataset
        position: Position to filter for (qb, rb, wr)
        min_samples: Minimum required samples
        
    Returns:
        Filtered DataFrame for position
        
    Raises:
        DataValidationError: If insufficient data
    """
    logger.info(f"Filtering data for position: {position.upper()}")
    
    # Filter by position (case insensitive)
    pos_df = df[df['position'].str.lower() == position.lower()].copy()
    
    if len(pos_df) < min_samples:
        raise DataValidationError(
            f"Insufficient data for {position.upper()}: {len(pos_df)} samples "
            f"(minimum: {min_samples})"
        )
    
    # Check target variable distribution
    target_counts = pos_df['division'].value_counts()
    logger.info(f"{position.upper()} target distribution: {target_counts.to_dict()}")
    
    # Warn if single class
    if len(target_counts) == 1:
        logger.warning(f"Single class detected for {position.upper()}: {target_counts.index[0]}")
    
    logger.info(f"Position {position.upper()} data ready: {len(pos_df)} samples")
    return pos_df

def train_position_pipeline(
    df: pd.DataFrame, 
    position: str,
    version: str,
    models_dir: str = "models",
    changelog: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Train and export pipeline for a specific position
    
    Args:
        df: Training data for position
        position: Position (qb, rb, wr)
        version: Model version string
        models_dir: Directory to save models
        changelog: List of changes for this version
        
    Returns:
        Dictionary with training results and file paths
        
    Raises:
        ModelTrainingError: If training fails
        ModelVersionError: If version issues
    """
    logger.info(f"Training {position.upper()} pipeline version {version}")
    
    try:
        # Initialize pipeline with position-specific config
        config = PipelineConfig(
            min_training_rows=max(30, len(df) // 10),  # Dynamic minimum based on data size
            test_size=0.2,
            random_state=42
        )
        
        pipeline = RecruitRevealPipeline(position=position, config=config)
        
        # Prepare training data
        # Assume the pipeline handles feature selection internally
        X = df  # Full DataFrame - pipeline will extract features
        y = df['division']  # Target variable
        
        logger.info(f"Training {position.upper()} pipeline with {len(X)} samples")
        
        # Fit the pipeline
        pipeline.fit(X, y)
        
        logger.info(f"Training completed for {position.upper()}")
        
        # Generate changelog if not provided
        if changelog is None:
            changelog = [
                f"Trained {position.upper()} pipeline with {len(X)} samples",
                f"Data distribution: {y.value_counts().to_dict()}",
                "Production-ready pipeline with comprehensive preprocessing"
            ]
        
        # Save the pipeline
        created_files = pipeline.save_pipeline(
            models_dir=models_dir,
            model_version=version,
            changes=changelog,
            notes=f"Production {position.upper()} pipeline v{version} trained on {len(X)} samples"
        )
        
        # Return training summary
        training_summary = {
            'position': position.upper(),
            'version': version,
            'training_samples': len(X),
            'target_distribution': y.value_counts().to_dict(),
            'created_files': {k: str(v) for k, v in created_files.items()},
            'metadata': pipeline.training_metadata_
        }
        
        logger.info(f"✅ {position.upper()} pipeline v{version} exported successfully")
        return training_summary
        
    except Exception as e:
        logger.error(f"❌ Failed to train {position.upper()} pipeline: {str(e)}")
        raise ModelTrainingError(f"Training failed for {position}: {str(e)}")

def main():
    """Main entry point for training and export script"""
    parser = argparse.ArgumentParser(
        description="Train and export Recruit Reveal ML pipelines",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Train all positions with version 1.0.0
  python -m scripts.train_and_export --csv data/training.csv --position all --version 1.0.0
  
  # Train specific position
  python -m scripts.train_and_export --csv data/training.csv --position qb --version 1.1.0
  
  # Specify custom models directory
  python -m scripts.train_and_export --csv data/training.csv --position all --version 1.0.0 --models-dir ml-api/models
        """
    )
    
    parser.add_argument(
        '--csv', 
        required=True,
        help='Path to training data CSV file'
    )
    
    parser.add_argument(
        '--position',
        choices=['qb', 'rb', 'wr', 'all'],
        required=True,
        help='Position to train (qb, rb, wr, or all)'
    )
    
    parser.add_argument(
        '--version',
        required=True,
        help='Semantic version string (e.g., 1.0.0, 1.2.1-beta)'
    )
    
    parser.add_argument(
        '--models-dir',
        default='models',
        help='Directory to save model files (default: models)'
    )
    
    parser.add_argument(
        '--min-samples',
        type=int,
        default=30,
        help='Minimum samples required per position (default: 30)'
    )
    
    parser.add_argument(
        '--changelog',
        nargs='*',
        help='Changelog entries for this version'
    )
    
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    
    args = parser.parse_args()
    
    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    logger.info("=" * 80)
    logger.info("RECRUIT REVEAL PIPELINE TRAINING AND EXPORT")
    logger.info("=" * 80)
    logger.info(f"CSV: {args.csv}")
    logger.info(f"Position: {args.position}")
    logger.info(f"Version: {args.version}")
    logger.info(f"Models directory: {args.models_dir}")
    logger.info(f"Minimum samples: {args.min_samples}")
    
    try:
        # Validate version format
        from recruit_reveal_production_pipeline import ModelVersionManager
        if not ModelVersionManager.validate_version(args.version):
            raise ValueError(f"Invalid version format: {args.version}")
        
        # Load and validate data
        df = load_and_validate_data(args.csv)
        
        # Determine positions to train
        if args.position == 'all':
            positions = ['qb', 'rb', 'wr']
        else:
            positions = [args.position]
        
        # Train each position
        results = {}
        models_dir = Path(args.models_dir)
        models_dir.mkdir(parents=True, exist_ok=True)
        
        for position in positions:
            logger.info(f"\n🏈 TRAINING {position.upper()} PIPELINE")
            logger.info("=" * 60)
            
            try:
                # Filter data for position
                pos_df = filter_data_for_position(df, position, args.min_samples)
                
                # Train and export
                result = train_position_pipeline(
                    pos_df, 
                    position, 
                    args.version,
                    args.models_dir,
                    args.changelog
                )
                
                results[position] = result
                
            except (DataValidationError, ModelTrainingError) as e:
                logger.error(f"❌ Failed to train {position.upper()}: {str(e)}")
                results[position] = {'error': str(e)}
                continue
        
        # Print summary
        logger.info("\n" + "=" * 80)
        logger.info("TRAINING SUMMARY")
        logger.info("=" * 80)
        
        successful = 0
        failed = 0
        
        for position, result in results.items():
            if 'error' in result:
                logger.error(f"❌ {position.upper()}: {result['error']}")
                failed += 1
            else:
                logger.info(f"✅ {position.upper()}: v{result['version']} ({result['training_samples']} samples)")
                successful += 1
        
        logger.info(f"\nResults: {successful} successful, {failed} failed")
        
        if successful > 0:
            logger.info(f"\n📁 Model files created in: {Path(args.models_dir).absolute()}")
            logger.info("🚀 Models ready for API deployment!")
        
        # Exit with error code if any training failed
        if failed > 0:
            sys.exit(1)
        
    except Exception as e:
        logger.error(f"❌ Training script failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()