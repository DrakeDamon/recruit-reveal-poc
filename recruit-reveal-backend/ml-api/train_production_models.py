#!/usr/bin/env python3
"""
Train Production Models with Real Data
Uses shared_preprocessing.py to train XGBoost models achieving ~87% accuracy
"""

import logging
import pandas as pd
import numpy as np
import joblib
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Tuple
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from xgboost import XGBClassifier
from shared_preprocessing import preprocess_data, get_feature_columns, TARGET_MAP

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Production model parameters (from DEPLOYMENT_GUIDE.md)
XGBOOST_CONFIG = {
    'n_estimators': 300,
    'max_depth': 6, 
    'learning_rate': 0.05,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'random_state': 42,
    'objective': 'multi:softmax',
    'num_class': 4,  # Power5=3, FCS=2, D2=1, D3/NAIA=0
    'eval_metric': 'mlogloss',
    'tree_method': 'hist',
    'verbosity': 0
}

TRAIN_PARAMS = {
    'test_size': 0.15,
    'random_state': 42,
    'stratify': True
}

def load_training_data(data_dir: Path) -> Dict[str, pd.DataFrame]:
    """Load real training data for all positions"""
    logger.info(f"Loading training data from {data_dir}")
    
    positions = ['qb', 'rb', 'wr']
    data = {}
    
    for position in positions:
        csv_path = data_dir / f"{position}.csv"
        
        if not csv_path.exists():
            logger.error(f"Training data not found: {csv_path}")
            continue
            
        try:
            df = pd.read_csv(csv_path)
            logger.info(f"Loaded {position.upper()}: {len(df)} samples, {df.shape[1]} columns")
            
            # Log division distribution
            if 'Division' in df.columns or 'division' in df.columns:
                div_col = 'Division' if 'Division' in df.columns else 'division'
                division_counts = df[div_col].value_counts()
                logger.info(f"  Division distribution: {dict(division_counts)}")
            
            data[position] = df
            
        except Exception as e:
            logger.error(f"Failed to load {position} data: {e}")
            continue
    
    return data

def train_position_model(df: pd.DataFrame, position: str) -> Tuple[XGBClassifier, Dict[str, Any], Dict[str, List[float]]]:
    """Train XGBoost model for specific position with evaluation"""
    logger.info(f"Training {position.upper()} model with {len(df)} samples")
    
    # Preprocess data using shared pipeline
    processed_df = preprocess_data(df, position, training_stats=None)
    
    # Get features and target
    feature_cols = get_feature_columns(processed_df)
    X = processed_df[feature_cols]
    y = processed_df['target']
    
    logger.info(f"Features: {len(feature_cols)}, Target classes: {sorted(y.unique())}")
    
    # Train/test split with stratification
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, 
        test_size=TRAIN_PARAMS['test_size'],
        random_state=TRAIN_PARAMS['random_state'],
        stratify=y
    )
    
    logger.info(f"Training samples: {len(X_train)}, Test samples: {len(X_test)}")
    
    # Create and train XGBoost model
    model = XGBClassifier(**XGBOOST_CONFIG)
    
    # Fit model
    model.fit(X_train, y_train)
    
    # Evaluate model
    train_pred = model.predict(X_train)
    test_pred = model.predict(X_test)
    
    train_acc = accuracy_score(y_train, train_pred)
    test_acc = accuracy_score(y_test, test_pred)
    
    # Within-one accuracy (critical metric)
    within_one_train = np.mean(np.abs(train_pred - y_train) <= 1)
    within_one_test = np.mean(np.abs(test_pred - y_test) <= 1)
    
    # Classification report
    report = classification_report(y_test, test_pred, output_dict=True, zero_division=0)
    
    logger.info(f"  Train accuracy: {train_acc:.3f}")
    logger.info(f"  Test accuracy: {test_acc:.3f}")
    logger.info(f"  Within-one train: {within_one_train:.3f}")
    logger.info(f"  Within-one test: {within_one_test:.3f}")
    
    # Check if meets production standards
    if test_acc >= 0.87:
        logger.info(f"  ✅ {position.upper()}: MEETS production target (≥87%)")
    else:
        logger.warning(f"  ⚠️ {position.upper()}: Below target ({test_acc:.1%} < 87%)")
    
    # Create metadata
    metadata = {
        'model_version': '1.1.0',
        'position': position.upper(),
        'training_timestamp': datetime.utcnow().isoformat(),
        'training_samples': len(X_train),
        'test_samples': len(X_test),
        'features_count': len(feature_cols),
        'feature_names': feature_cols,
        'target_map': TARGET_MAP,
        'accuracy': test_acc,
        'train_accuracy': train_acc,
        'within_one_accuracy': within_one_test,
        'within_one_train': within_one_train,
        'classification_report': report,
        'xgboost_params': XGBOOST_CONFIG,
        'preprocessing_pipeline': 'shared_preprocessing.py',
        'data_source': 'real_training_data'
    }
    
    # Store training statistics for inference
    training_stats = {}
    for col in X.select_dtypes(include=[np.number]).columns:
        clean_values = X[col].dropna()
        if len(clean_values) > 0:
            training_stats[col] = clean_values.tolist()
    
    return model, metadata, training_stats

def save_model(model: XGBClassifier, metadata: Dict[str, Any], 
               training_stats: Dict[str, List[float]], position: str, output_dir: Path):
    """Save trained model, metadata, and training statistics"""
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    version = metadata['model_version']
    
    # Save model
    model_path = output_dir / f"recruit_reveal_{position}_pipeline_v{version}.pkl"
    joblib.dump(model, model_path)
    logger.info(f"Saved model: {model_path}")
    
    # Save metadata
    metadata_path = output_dir / f"recruit_reveal_{position}_pipeline_v{version}.metadata.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"Saved metadata: {metadata_path}")
    
    # Save training statistics for inference
    stats_path = output_dir / f"recruit_reveal_{position}_pipeline_v{version}.stats.json"
    with open(stats_path, 'w') as f:
        json.dump(training_stats, f, indent=2)
    logger.info(f"Saved training stats: {stats_path}")
    
    # Create "latest" symlinks for easy deployment
    latest_model = output_dir / f"recruit_reveal_{position}_pipeline_latest.pkl"
    latest_metadata = output_dir / f"recruit_reveal_{position}_pipeline_latest.metadata.json"
    latest_stats = output_dir / f"recruit_reveal_{position}_pipeline_latest.stats.json"
    
    # Remove existing symlinks and create new ones
    for path in [latest_model, latest_metadata, latest_stats]:
        if path.exists():
            path.unlink()
    
    latest_model.symlink_to(model_path.name)
    latest_metadata.symlink_to(metadata_path.name) 
    latest_stats.symlink_to(stats_path.name)
    
    logger.info(f"Created latest symlinks for {position.upper()}")

def main():
    """Main training function"""
    logger.info("🏈 Starting Production Model Training")
    logger.info("=" * 60)
    
    # Setup paths
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / "data"  # recruit-reveal-backend/data/
    output_dir = script_dir / "models"
    
    logger.info(f"Data directory: {data_dir}")
    logger.info(f"Output directory: {output_dir}")
    
    # Load training data
    training_data = load_training_data(data_dir)
    
    if not training_data:
        logger.error("❌ No training data found! Expected files:")
        logger.error("  - recruit-reveal-backend/data/qb.csv")
        logger.error("  - recruit-reveal-backend/data/rb.csv")  
        logger.error("  - recruit-reveal-backend/data/wr.csv")
        return
    
    logger.info(f"Loaded data for positions: {list(training_data.keys())}")
    
    # Train models for each position
    results = {}
    
    for position, df in training_data.items():
        try:
            logger.info(f"\n📊 Training {position.upper()} model...")
            
            model, metadata, training_stats = train_position_model(df, position)
            
            # Save model and metadata
            save_model(model, metadata, training_stats, position, output_dir)
            
            results[position] = {
                'accuracy': metadata['accuracy'],
                'within_one': metadata['within_one_accuracy'],
                'samples': metadata['training_samples'] + metadata['test_samples'],
                'features': metadata['features_count']
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to train {position.upper()} model: {e}")
            import traceback
            traceback.print_exc()
            continue
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("🎯 TRAINING RESULTS SUMMARY")
    logger.info("=" * 60)
    
    overall_accuracies = []
    
    for position, result in results.items():
        acc = result['accuracy']
        within_one = result['within_one']
        samples = result['samples']
        features = result['features']
        
        status = "✅ MEETS TARGET" if acc >= 0.87 else "⚠️  BELOW TARGET"
        
        logger.info(f"{position.upper():3s}: {acc:.1%} exact, {within_one:.1%} within-one "
                   f"({samples} samples, {features} features) {status}")
        
        overall_accuracies.append(acc)
    
    if overall_accuracies:
        avg_accuracy = np.mean(overall_accuracies)
        logger.info(f"\nOverall average accuracy: {avg_accuracy:.1%}")
        
        if avg_accuracy >= 0.87:
            logger.info("🎉 SUCCESS: Production accuracy target achieved!")
        else:
            logger.warning("⚠️  WARNING: Below production target. Review data quality and preprocessing.")
    
    # List created files
    logger.info(f"\nGenerated files in {output_dir}:")
    if output_dir.exists():
        for file in sorted(output_dir.glob("recruit_reveal_*")):
            size_mb = file.stat().st_size / (1024 * 1024)
            logger.info(f"  {file.name} ({size_mb:.1f} MB)")

if __name__ == "__main__":
    main()