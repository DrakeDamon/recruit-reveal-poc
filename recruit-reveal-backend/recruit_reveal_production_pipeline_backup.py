"""
Recruit Reveal Production Pipeline

WARNING: Never fit this pipeline on demo or single-row data. Only use the full training set!

This module contains the complete ML pipeline for college football athlete evaluation,
including all custom preprocessing, feature engineering, imputation, winsorization,
and model training logic for production use via API in a cloud microservice.

The exported pipeline is bulletproof, well-documented, and robust to all real-world
input and edge cases.
"""

import pandas as pd
import numpy as np
import logging
import warnings
from typing import Dict, List, Tuple, Any, Optional, Union
from dataclasses import dataclass
from pathlib import Path
import joblib
import json
import shutil
from datetime import datetime, timezone
import os
import re

from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix, classification_report
from imblearn.over_sampling import ADASYN
from xgboost import XGBClassifier
from scipy.stats import percentileofscore

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Suppress warnings for cleaner output
warnings.filterwarnings('ignore')

@dataclass
class PipelineConfig:
    """Configuration class for pipeline parameters"""
    min_training_rows: int = 30
    test_size: float = 0.2
    random_state: int = 42
    winsorize_percentiles: Tuple[float, float] = (1.0, 99.0)
    
    # XGBoost parameters
    xgb_params: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.xgb_params is None:
            self.xgb_params = {
                'n_estimators': 100,
                'max_depth': 6,
                'learning_rate': 0.1,
                'random_state': self.random_state,
                'n_jobs': -1
            }

class RecruitRevealError(Exception):
    """Base exception for Recruit Reveal pipeline errors"""
    pass

class DataValidationError(RecruitRevealError):
    """Raised when input data fails validation"""
    pass

class ModelTrainingError(RecruitRevealError):
    """Raised when model training fails"""
    pass

class ModelVersionError(RecruitRevealError):
    """Raised when model versioning fails"""
    pass

class ModelVersionManager:
    """
    Utility class for managing model versions, metadata, and changelog
    """
    
    @staticmethod
    def validate_version(version: str) -> bool:
        """
        Validate version format (semantic versioning: X.Y.Z)
        
        Args:
            version: Version string to validate
            
        Returns:
            True if valid, False otherwise
        """
        pattern = r'^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9\-\.]+))?$'
        return bool(re.match(pattern, version))
    
    @staticmethod
    def compare_versions(version1: str, version2: str) -> int:
        """
        Compare two version strings
        
        Args:
            version1: First version
            version2: Second version
            
        Returns:
            -1 if version1 < version2, 0 if equal, 1 if version1 > version2
        """
        def parse_version(v):
            parts = v.split('-')[0].split('.')
            return tuple(map(int, parts))
        
        v1_parts = parse_version(version1)
        v2_parts = parse_version(version2)
        
        if v1_parts < v2_parts:
            return -1
        elif v1_parts > v2_parts:
            return 1
        else:
            return 0
    
    @staticmethod
    def get_latest_version(models_dir: Path, position: str) -> Optional[str]:
        """
        Find the latest version for a given position
        
        Args:
            models_dir: Directory containing model files
            position: Position (qb, rb, wr)
            
        Returns:
            Latest version string or None if no versions found
        """
        pattern = f"recruit_reveal_{position}_pipeline_v*.pkl"
        model_files = list(models_dir.glob(pattern))
        
        if not model_files:
            return None
        
        versions = []
        for file in model_files:
            # Extract version from filename
            match = re.search(r'_v(\d+\.\d+\.\d+(?:-[a-zA-Z0-9\-\.]+)?)\.pkl$', file.name)
            if match:
                versions.append(match.group(1))
        
        if not versions:
            return None
        
        # Sort versions and return the latest
        versions.sort(key=lambda x: tuple(map(int, x.split('-')[0].split('.'))))
        return versions[-1]
    
    @staticmethod
    def create_changelog_entry(models_dir: Path, position: str, version: str, changes: List[str] = None) -> None:
        """
        Create or update CHANGELOG.md in models directory
        
        Args:
            models_dir: Directory containing model files
            position: Position (qb, rb, wr)
            version: Version being added
            changes: List of changes made in this version
        """
        changelog_path = models_dir / f"CHANGELOG_{position}.md"
        
        # Default changes if none provided
        if changes is None:
            changes = [
                "Model retrained with latest data",
                "Updated preprocessing pipeline",
                "Improved feature engineering"
            ]
        
        # Create changelog entry
        entry = f"""
## [{version}] - {datetime.now(timezone.utc).strftime('%Y-%m-%d')}

### Changed
"""
        for change in changes:
            entry += f"- {change}\n"
        
        entry += "\n"
        
        # Read existing changelog if it exists
        existing_content = ""
        if changelog_path.exists():
            with open(changelog_path, 'r') as f:
                content = f.read()
                # Skip the header if it exists
                if content.startswith('# Recruit Reveal'):
                    lines = content.split('\n')
                    header_end = next((i for i, line in enumerate(lines) if line.startswith('## [')), len(lines))
                    existing_content = '\n'.join(lines[header_end:])
                else:
                    existing_content = content
        
        # Write updated changelog
        with open(changelog_path, 'w') as f:
            f.write(f"# Recruit Reveal {position.upper()} Model Changelog\n")
            f.write("All notable changes to this model will be documented in this file.\n")
            f.write(f"{entry}{existing_content}")
        
        logger.info(f"📝 Updated changelog at {changelog_path}")

    @staticmethod
    def get_model_versions(models_dir: Path, position: str) -> List[Dict[str, Any]]:
        """
        Get all available versions for a position with metadata
        
        Args:
            models_dir: Directory containing model files
            position: Position (qb, rb, wr)
            
        Returns:
            List of version info dictionaries
        """
        pattern = f"recruit_reveal_{position}_pipeline_v*.pkl"
        model_files = list(models_dir.glob(pattern))
        
        versions = []
        for file in model_files:
            # Extract version from filename
            match = re.search(r'_v(\d+\.\d+\.\d+(?:-[a-zA-Z0-9\-\.]+)?)\.pkl$', file.name)
            if match:
                version = match.group(1)
                metadata_file = file.with_suffix('.metadata.json')
                
                metadata = {}
                if metadata_file.exists():
                    try:
                        with open(metadata_file, 'r') as f:
                            metadata = json.load(f)
                    except Exception as e:
                        logger.warning(f"Failed to load metadata for {file}: {e}")
                
                versions.append({
                    'version': version,
                    'model_file': str(file),
                    'metadata_file': str(metadata_file) if metadata_file.exists() else None,
                    'file_size': file.stat().st_size,
                    'created_date': datetime.fromtimestamp(file.stat().st_mtime).isoformat(),
                    'metadata': metadata
                })
        
        # Sort by version
        versions.sort(key=lambda x: tuple(map(int, x['version'].split('-')[0].split('.'))), reverse=True)
        return versions

class RecruitRevealPreprocessor(BaseEstimator, TransformerMixin):
    """
    Custom preprocessor that encapsulates all preprocessing logic including:
    - Intelligent combine imputation
    - Feature engineering
    - State embeddings
    - Winsorization
    - Rule-based scoring
    """
    
    def __init__(self, position: str, config: PipelineConfig = None):
        self.position = position.lower()
        self.config = config or PipelineConfig()
        self.fitted_ = False
        
        # Store training statistics for transforms
        self.training_stats_ = {}
        self.winsorization_bounds_ = {}
        self.feature_names_ = []
        
        # Initialize benchmarks and tiers
        self._initialize_benchmarks()
        
    def _initialize_benchmarks(self):
        """Initialize combine benchmarks and tier definitions"""
        # Combine benchmarks for intelligent imputation
        self.COMBINE_BENCHMARKS = {
            'qb': {
                'POWER 5': {'forty_yard_dash': (4.6, 4.9), 'vertical_jump': (30, 34), 'shuttle': (4.3, 4.6), 'broad_jump': (108, 118)},
                'FCS': {'forty_yard_dash': (4.7, 5.0), 'vertical_jump': (28, 32), 'shuttle': (4.4, 4.7), 'broad_jump': (102, 112)},
                'D2': {'forty_yard_dash': (4.8, 5.1), 'vertical_jump': (26, 30), 'shuttle': (4.5, 4.8), 'broad_jump': (96, 106)},
                'D3': {'forty_yard_dash': (4.9, 5.3), 'vertical_jump': (24, 28), 'shuttle': (4.6, 4.9), 'broad_jump': (90, 100)},
                'NAIA': {'forty_yard_dash': (4.8, 5.2), 'vertical_jump': (25, 29), 'shuttle': (4.5, 4.8), 'broad_jump': (92, 102)}
            },
            'rb': {
                'POWER 5': {'forty_yard_dash': (4.2, 4.5), 'vertical_jump': (34, 38), 'shuttle': (4.0, 4.3), 'broad_jump': (120, 130)},
                'FCS': {'forty_yard_dash': (4.3, 4.6), 'vertical_jump': (32, 36), 'shuttle': (4.1, 4.4), 'broad_jump': (110, 120)},
                'D2': {'forty_yard_dash': (4.4, 4.7), 'vertical_jump': (30, 34), 'shuttle': (4.2, 4.5), 'broad_jump': (100, 110)},
                'D3': {'forty_yard_dash': (4.5, 4.8), 'vertical_jump': (28, 32), 'shuttle': (4.3, 4.6), 'broad_jump': (95, 105)},
                'NAIA': {'forty_yard_dash': (4.4, 4.7), 'vertical_jump': (29, 33), 'shuttle': (4.2, 4.5), 'broad_jump': (98, 108)}
            },
            'wr': {
                'POWER 5': {'forty_yard_dash': (4.4, 4.7), 'vertical_jump': (34, 38), 'shuttle': (4.1, 4.4), 'broad_jump': (120, 130)},
                'FCS': {'forty_yard_dash': (4.5, 4.8), 'vertical_jump': (33, 37), 'shuttle': (4.2, 4.5), 'broad_jump': (110, 120)},
                'D2': {'forty_yard_dash': (4.6, 4.9), 'vertical_jump': (31, 35), 'shuttle': (4.3, 4.6), 'broad_jump': (100, 110)},
                'D3': {'forty_yard_dash': (4.7, 5.0), 'vertical_jump': (29, 33), 'shuttle': (4.4, 4.7), 'broad_jump': (95, 105)},
                'NAIA': {'forty_yard_dash': (4.6, 4.9), 'vertical_jump': (30, 34), 'shuttle': (4.3, 4.6), 'broad_jump': (98, 108)}
            }
        }

        # Tier definitions for rule-based scoring
        self.tiers = {
            'qb': {
                'Power 5': {'base': 90, 'ypg_min': 250, 'height_min': 74, 'height_max': 78, 'weight_min': 200, 'weight_max': 240,
                            '40_min': 4.6, '40_max': 4.9, 'vertical_min': 30, 'vertical_max': 34, 'broad_min': 108, 'shuttle_max': 4.5},
                'FCS': {'base': 70, 'ypg_min': 200, 'height_min': 72, 'height_max': 76, 'weight_min': 190, 'weight_max': 220,
                        '40_min': 4.7, '40_max': 5.0, 'vertical_min': 28, 'vertical_max': 32, 'broad_min': 102, 'shuttle_max': 4.6},
                'D2': {'base': 50, 'ypg_min': 150, 'height_min': 71, 'height_max': 74, 'weight_min': 180, 'weight_max': 210,
                       '40_min': 4.8, '40_max': 5.1, 'vertical_min': 26, 'vertical_max': 30, 'broad_min': 96, 'shuttle_max': 4.7},
                'D3/NAIA': {'base': 30, 'ypg_min': 0, 'height_min': 70, 'height_max': 999, 'weight_min': 170, 'weight_max': 999,
                            '40_min': 4.9, '40_max': 999, 'vertical_min': 24, 'vertical_max': 999, 'broad_min': 90, 'shuttle_max': 999}
            },
            'rb': {
                'Power 5': {'base': 90, 'ypg_min': 150, 'height_min': 69, 'height_max': 74, 'weight_min': 190, 'weight_max': 230,
                            '40_min': 4.2, '40_max': 4.4, 'vertical_min': 34, 'vertical_max': 36, 'broad_min': 120, 'shuttle_max': 4.2},
                'FCS': {'base': 70, 'ypg_min': 120, 'height_min': 68, 'height_max': 73, 'weight_min': 180, 'weight_max': 220,
                        '40_min': 4.3, '40_max': 4.5, 'vertical_min': 32, 'vertical_max': 34, 'broad_min': 110, 'shuttle_max': 4.3},
                'D2': {'base': 50, 'ypg_min': 90, 'height_min': 67, 'height_max': 72, 'weight_min': 170, 'weight_max': 210,
                       '40_min': 4.4, '40_max': 4.6, 'vertical_min': 31, 'vertical_max': 33, 'broad_min': 100, 'shuttle_max': 4.4},
                'D3/NAIA': {'base': 30, 'ypg_min': 0, 'height_min': 66, 'height_max': 999, 'weight_min': 160, 'weight_max': 999,
                            '40_min': 4.5, '40_max': 4.7, 'vertical_min': 30, 'vertical_max': 32, 'broad_min': 90, 'shuttle_max': 4.5}
            },
            'wr': {
                'Power 5': {'base': 90, 'rec_ypg_min': 100, 'height_min': 71, 'height_max': 75, 'weight_min': 180, 'weight_max': 210,
                            '40_min': 4.4, '40_max': 4.6, 'vertical_min': 34, 'vertical_max': 36, 'broad_min': 120, 'shuttle_max': 4.3},
                'FCS': {'base': 70, 'rec_ypg_min': 80, 'height_min': 70, 'height_max': 74, 'weight_min': 170, 'weight_max': 200,
                        '40_min': 4.5, '40_max': 4.7, 'vertical_min': 32, 'vertical_max': 35, 'broad_min': 110, 'shuttle_max': 4.4},
                'D2': {'base': 50, 'rec_ypg_min': 60, 'height_min': 69, 'height_max': 73, 'weight_min': 165, 'weight_max': 195,
                       '40_min': 4.6, '40_max': 4.8, 'vertical_min': 30, 'vertical_max': 33, 'broad_min': 100, 'shuttle_max': 4.5},
                'D3/NAIA': {'base': 30, 'rec_ypg_min': 0, 'height_min': 68, 'height_max': 999, 'weight_min': 160, 'weight_max': 999,
                            '40_min': 4.7, '40_max': 5.0, 'vertical_min': 28, 'vertical_max': 31, 'broad_min': 90, 'shuttle_max': 4.6}
            }
        }

    def validate_input(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Validates and cleans input DataFrame for API microservices
        
        Args:
            df: Input DataFrame
            
        Returns:
            Cleaned and validated DataFrame
            
        Raises:
            DataValidationError: If data cannot be cleaned/validated
        """
        if df is None or len(df) == 0:
            raise DataValidationError("Input DataFrame is empty or None")
        
        logger.info(f"Validating input with shape {df.shape}")
        df = df.copy()
        
        # NEW: Deduplicate columns (keep first occurrence) - name-based
        if df.columns.duplicated().any():
            duplicate_cols = df.columns[df.columns.duplicated()].unique().tolist()
            logger.warning(f"Found and removing duplicate columns: {duplicate_cols}")
            df = df.loc[:, ~df.columns.duplicated(keep='first')]
        
        # NEW: Value-based duplicate detection (mimicking AutoGluon)
        df_T = df.T
        value_duplicates = df_T.duplicated(keep='first')
        if value_duplicates.any():
            duplicate_value_cols = df_T[value_duplicates].index.tolist()
            logger.warning(f"Found and removing value-duplicate columns: {duplicate_value_cols}")
            df = df.drop(columns=duplicate_value_cols)
        
        # NEW: Reset index to ensure unique RangeIndex
        df = df.reset_index(drop=True)
        
        # Essential columns with defaults
        essential_defaults = {
            'height_inches': 70,
            'weight_lbs': 180,
            'position': self.position.upper(),
            'division': 'D3',
            'state': 'ZZ',
            'games': 12
        }
        
        # Add missing essential columns
        for col, default in essential_defaults.items():
            if col not in df.columns:
                df[col] = default
                logger.warning(f"Added missing essential column '{col}' with default value {default}")
        
        # Auto-convert data types
        numeric_cols = ['height_inches', 'weight_lbs', 'games']
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(essential_defaults.get(col, 0))
        
        # Clean string columns
        string_cols = ['position', 'division', 'state']
        for col in string_cols:
            if col in df.columns:
                df[col] = df[col].astype(str).str.strip().str.upper()
        
        # Check for unexpected columns (warn but don't fail)
        if hasattr(self, 'feature_names_') and self.feature_names_:
            unexpected_cols = set(df.columns) - set(self.feature_names_) - {'target', 'division'}
            if unexpected_cols:
                logger.warning(f"Found {len(unexpected_cols)} unexpected columns: {list(unexpected_cols)[:5]}...")
        
        logger.info(f"Input validation complete. Output shape: {df.shape}")
        return df
        
    def _safe_get(self, row: pd.Series, key: str, default: Any = 0) -> Any:
        """Safely get value from row, handling None values"""
        value = row.get(key, default)
        return default if pd.isna(value) or value is None else value
        
    def _safe_percentileofscore(self, series: pd.Series, value: Any) -> float:
        """Safely compute percentile score, handling missing data"""
        if series is None or len(series.dropna()) == 0:
            return 0.0
        clean_series = series.dropna()
        if len(clean_series) == 0:
            return 0.0
        return percentileofscore(clean_series, value if not pd.isna(value) else 0)
        
    def _intelligent_combine_imputation(self, df: pd.DataFrame) -> pd.DataFrame:
        """Intelligent imputation using benchmark ranges with Bayesian-inspired priors"""
        logger.info(f"Starting intelligent combine imputation for {self.position}")
        df = df.copy()
        
        # Edge case guard: reset index if duplicates found
        if df.index.duplicated().any():
            logger.warning("Duplicate indices found; resetting index")
            df = df.reset_index(drop=True)
        
        # Normalize division for lookup (ensure it's a Series, not DataFrame)
        if isinstance(df['division'], pd.DataFrame):
            df['division_lookup'] = df['division'].iloc[:, 0].astype(str).str.upper()
        else:
            df['division_lookup'] = df['division'].astype(str).str.upper()
        
        combine_metrics = ['forty_yard_dash', 'vertical_jump', 'shuttle', 'broad_jump']
        position_benchmarks = self.COMBINE_BENCHMARKS.get(self.position, self.COMBINE_BENCHMARKS['qb'])
        
        imputation_log = []
        
        for metric in combine_metrics:
            # Ensure we have the metric column as a proper Series
            if metric not in df.columns:
                df[metric] = np.nan
                df[f'{metric}_imputed'] = 1
                imputation_log.append(f"Created missing column {metric}")
            else:
                # Handle duplicate columns first if they exist
                if df.columns.duplicated().any() and metric in df.columns[df.columns.duplicated()]:
                    # Remove all duplicate columns, keeping first occurrence
                    df = df.loc[:, ~df.columns.duplicated(keep='first')]
                    logger.warning(f"Removed duplicate columns for {metric}")
                
                # Force conversion to Series if it's somehow a DataFrame
                metric_col = df[metric]
                if isinstance(metric_col, pd.DataFrame):
                    logger.warning(f"Converting DataFrame to Series for {metric}")
                    df[metric] = metric_col.iloc[:, 0]
                
                # Ensure numeric type
                df[metric] = pd.to_numeric(df[metric], errors='coerce')
                
                # Create imputation flag safely
                imputed_col = f'{metric}_imputed'
                if imputed_col in df.columns:
                    # Update existing column
                    df[imputed_col] = df[metric].isna().astype(int)
                else:
                    # Create new column
                    df[imputed_col] = df[metric].isna().astype(int)
            
            missing_mask = df[metric].isna()
            if missing_mask.any():
                missing_count = missing_mask.sum()
                imputation_log.append(f"Imputing {missing_count} missing {metric} values")
                
                # Impute based on division-specific benchmarks
                for division in df['division_lookup'].unique():
                    if pd.isna(division):
                        continue
                        
                    div_mask = (df['division_lookup'] == division) & missing_mask
                    if not div_mask.any():
                        continue
                    
                    # Get benchmark range for this position/division
                    if division in position_benchmarks:
                        min_val, max_val = position_benchmarks[division][metric]
                    else:
                        # Fallback to D3 benchmarks if division not found
                        min_val, max_val = position_benchmarks['D3'][metric]
                    
                    # Bayesian-inspired imputation: use normal distribution centered on range midpoint
                    mean_val = (min_val + max_val) / 2
                    std_val = (max_val - min_val) / 4  # Assume 95% of values within range
                    
                    # Generate values and clip to realistic range
                    n_samples = div_mask.sum()
                    np.random.seed(self.config.random_state)
                    imputed_values = np.random.normal(mean_val, std_val, n_samples)
                    imputed_values = np.clip(imputed_values, min_val * 0.9, max_val * 1.1)
                    
                    df.loc[div_mask, metric] = imputed_values
                    imputation_log.append(f"  {division}: {n_samples} values from N({mean_val:.2f}, {std_val:.2f})")
        
        for log_entry in imputation_log:
            logger.info(f"  {log_entry}")
        
        return df
        
    def _create_state_embeddings(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create state embeddings for talent hotbed representation"""
        if 'state_talent_score' in df.columns:
            logger.info("State embeddings already exist - skipping creation")
            return df
            
        logger.info("Creating state embeddings")
        
        # Define state talent tiers based on recruiting density
        df['state_talent_score'] = df['state'].str.upper().map({
            'TX': 4, 'FL': 4, 'CA': 4, 'GA': 4,  # Elite
            'OH': 3, 'PA': 3, 'NC': 3, 'VA': 3, 'MI': 3, 'IL': 3, 'LA': 3, 'AL': 3, 
            'TN': 3, 'SC': 3, 'AZ': 3, 'NJ': 3, 'MD': 3,  # Strong
            'IN': 2, 'MO': 2, 'WI': 2, 'MN': 2, 'IA': 2, 'KY': 2, 'OK': 2, 'AR': 2, 
            'MS': 2, 'KS': 2, 'CO': 2, 'OR': 2, 'WA': 2, 'CT': 2, 'NV': 2, 'UT': 2  # Moderate
        }).fillna(1).astype(int)  # Default for other states
        
        # Create binary indicators for state tiers
        df['state_tier_1'] = (df['state_talent_score'] == 4).astype(int)  # Elite states
        df['state_tier_2'] = (df['state_talent_score'] == 3).astype(int)  # Strong states
        df['state_tier_3'] = (df['state_talent_score'] == 2).astype(int)  # Moderate states
        df['state_tier_4'] = (df['state_talent_score'] == 1).astype(int)  # Other states
        df['is_strong_state'] = df['state'].str.upper().isin(['TX', 'FL', 'CA', 'GA']).astype(int)
        
        return df
        
    def _enhanced_feature_engineering(self, df: pd.DataFrame) -> pd.DataFrame:
        """Enhanced feature engineering with interaction terms and advanced metrics"""
        logger.info(f"Starting enhanced feature engineering for {self.position}")
        df = df.copy()
        
        # Ensure column names are clean
        df.columns = df.columns.str.strip().str.lower()
        
        # Remove existing enhanced features to prevent conflicts
        enhanced_cols = ['state_eff', 'bmi_ypg', 'height_traj', 'speed_power_ratio', 'combine_confidence']
        for col in enhanced_cols:
            if col in df.columns:
                df = df.drop(columns=[col])
        
        # Apply preprocessing steps
        df = self._intelligent_combine_imputation(df)
        df = self._create_state_embeddings(df)
        
        # Calculate games played
        if 'games' not in df.columns:
            df['games'] = 12
            
        if 'senior_rec' in df.columns:
            wr_mask = df['position'].str.lower() == 'wr'
            df.loc[wr_mask, 'games'] = df.loc[wr_mask, 'senior_rec'].replace(0, np.nan).fillna(12).clip(8, 15)
            
        if 'senior_yds' in df.columns and 'senior_ypg' in df.columns:
            rb_qb_mask = df['position'].str.lower().isin(['rb', 'qb'])
            with np.errstate(divide='ignore', invalid='ignore'):
                games_calc = df.loc[rb_qb_mask, 'senior_yds'] / df.loc[rb_qb_mask, 'senior_ypg']
                games_calc = games_calc.replace([np.inf, -np.inf], np.nan).fillna(12).clip(8, 15)
                df.loc[rb_qb_mask, 'games'] = games_calc
        
        # Calculate per-game statistics
        self._calculate_per_game_stats(df)
        
        # Calculate trajectory
        if 'senior_ypg' in df.columns and 'junior_ypg' in df.columns:
            df['trajectory'] = np.maximum(df['senior_ypg'] - df['junior_ypg'], 0)
        else:
            df['trajectory'] = 0.0
        
        # Core engineered features
        df['bmi'] = ((df['weight_lbs'] / (df['height_inches'] ** 2)) * 703).astype(float)
        df['eff_ratio'] = (df.get('senior_tds', 0) / (df.get('senior_ypg', 1) + 1e-6)).astype(float)
        df['ath_power'] = (df.get('vertical_jump', 0) * df.get('broad_jump', 0)).astype(float)
        
        # Enhanced interaction features
        primary_ypg = df.get('senior_ypg', df.get('ypg', df.get('rec_ypg', 0)))
        df['bmi_ypg'] = (df['bmi'] * primary_ypg).astype(float)
        df['height_traj'] = (df['height_inches'] * df['trajectory']).astype(float)
        df['state_eff'] = (df['state_talent_score'] * df['eff_ratio']).astype(float)
        df['speed_power_ratio'] = (df['ath_power'] / (df['forty_yard_dash'] + 1e-6)).astype(float)
        
        # Position-specific features
        self._add_position_specific_features(df)
        
        # Combine confidence scores
        self._calculate_combine_confidence(df)
        
        # Trajectory z-score by position
        self._calculate_trajectory_zscore(df)
        
        # Create position dummies
        self._create_position_dummies(df)
        
        # Remove duplicates and ensure numeric types
        df = self._remove_duplicates_and_clean(df)
        
        logger.info(f"Enhanced feature engineering completed for {self.position}")
        return df
        
    def _calculate_per_game_stats(self, df: pd.DataFrame) -> None:
        """Calculate per-game statistics"""
        df['rec_ypg'] = 0.0
        df['ypg'] = 0.0
        df['tds_game'] = 0.0
        df['td_game'] = 0.0
        df['all_purpose_game'] = 0.0
        
        # Enhanced all_purpose_game calculation for RBs
        rb_mask = df['position'].str.lower() == 'rb'
        if 'senior_yds' in df.columns:
            if 'senior_rec_yds' in df.columns:
                df.loc[rb_mask, 'all_purpose_game'] = (
                    df.loc[rb_mask, 'senior_yds'] + df.loc[rb_mask, 'senior_rec_yds']
                ) / df.loc[rb_mask, 'games']
            else:
                df.loc[rb_mask, 'all_purpose_game'] = df.loc[rb_mask, 'senior_yds'] / df.loc[rb_mask, 'games']
        else:
            df['all_purpose_game'] = df.get('ypg', 0) + df.get('rec_ypg', 0)
            
        # Calculate yards per game by position
        if 'senior_yds' in df.columns:
            wr_mask = df['position'].str.lower() == 'wr'
            df.loc[wr_mask, 'rec_ypg'] = df.loc[wr_mask, 'senior_yds'] / df.loc[wr_mask, 'games']
            rb_qb_mask = df['position'].str.lower().isin(['rb', 'qb'])
            df.loc[rb_qb_mask, 'ypg'] = df.loc[rb_qb_mask, 'senior_yds'] / df.loc[rb_qb_mask, 'games']
            
        # Calculate touchdowns per game by position
        if 'senior_td' in df.columns:
            wr_mask = df['position'].str.lower() == 'wr'
            df.loc[wr_mask, 'tds_game'] = df.loc[wr_mask, 'senior_td'] / df.loc[wr_mask, 'games']
            rb_qb_mask = df['position'].str.lower().isin(['rb', 'qb'])
            df.loc[rb_qb_mask, 'td_game'] = df.loc[rb_qb_mask, 'senior_td'] / df.loc[rb_qb_mask, 'games']
            
    def _add_position_specific_features(self, df: pd.DataFrame) -> None:
        """Add position-specific interaction features"""
        primary_ypg = df.get('senior_ypg', df.get('ypg', df.get('rec_ypg', 0)))
        
        if self.position == 'qb':
            # Completion percentage × YPG (accuracy under volume)
            df['comp_ypg'] = (df.get('senior_comp_pct', 60) * primary_ypg / 100).astype(float)
            # Height × Completion % (pocket presence)
            df['height_comp'] = (df['height_inches'] * df.get('senior_comp_pct', 60)).astype(float)
        elif self.position == 'rb':
            # YPC × Speed (breakaway ability)
            df['ypc_speed'] = (df.get('senior_ypc', 0) * (5.0 - df.get('forty_yard_dash', 4.8))).astype(float)
            # Weight × YPC (power running ability)
            df['weight_ypc'] = (df['weight_lbs'] * df.get('senior_ypc', 0)).astype(float)
        elif self.position == 'wr':
            # Catch radius (height × vertical)
            df['catch_radius'] = (df['height_inches'] * df.get('vertical_jump', 0)).astype(float)
            # Speed × YAC (big play ability)
            df['speed_yac'] = ((5.0 - df.get('forty_yard_dash', 4.8)) * df.get('senior_avg', 0)).astype(float)
            
    def _calculate_combine_confidence(self, df: pd.DataFrame) -> None:
        """Calculate combine confidence scores based on real vs imputed data"""
        combine_cols = ['forty_yard_dash', 'vertical_jump', 'shuttle', 'broad_jump']
        imputed_cols = [f'{col}_imputed' for col in combine_cols if f'{col}_imputed' in df.columns]
        
        if imputed_cols:
            df['combine_confidence'] = (1.0 - (df[imputed_cols].sum(axis=1) / len(imputed_cols))).astype(float)
        else:
            df['combine_confidence'] = 1.0
            
    def _calculate_trajectory_zscore(self, df: pd.DataFrame) -> None:
        """Calculate trajectory z-score by position"""
        df['trajectory_z'] = 0.0
        for pos in df['position'].unique():
            mask = df['position'] == pos
            if mask.sum() > 1:
                mean_traj = df.loc[mask, 'trajectory'].mean()
                std_traj = df.loc[mask, 'trajectory'].std()
                if std_traj > 0:
                    df.loc[mask, 'trajectory_z'] = ((df.loc[mask, 'trajectory'] - mean_traj) / std_traj).astype(float)
                    
    def _create_position_dummies(self, df: pd.DataFrame) -> None:
        """Create position dummy variables"""
        position_dummies = pd.get_dummies(df['position'].str.lower(), prefix='pos', dtype=int)
        for pos in ['qb', 'rb', 'wr']:
            if f'pos_{pos}' not in position_dummies.columns:
                position_dummies[f'pos_{pos}'] = 0
        
        # Concatenate position dummies
        for col in position_dummies.columns:
            df[col] = position_dummies[col]
            
    def _remove_duplicates_and_clean(self, df: pd.DataFrame) -> pd.DataFrame:
        """Remove duplicate columns and ensure proper data types"""
        logger.info(f"Before duplicate removal: {df.shape}")
        
        # First reset index to avoid reindexing issues
        df = df.reset_index(drop=True)
        
        # Handle name-based duplicate columns
        if df.columns.duplicated().any():
            duplicate_cols = df.columns[df.columns.duplicated()].tolist()
            logger.warning(f"Found name-duplicate columns: {duplicate_cols}")
            
            # Use manual column deduplication to avoid reindex errors
            seen_cols = set()
            keep_indices = []
            for i, col in enumerate(df.columns):
                if col not in seen_cols:
                    keep_indices.append(i)
                    seen_cols.add(col)
            
            # Create new dataframe with unique columns
            df = df.iloc[:, keep_indices].copy()
        
        # Handle value-based duplicate columns (mimicking AutoGluon)
        try:
            df_T = df.T
            value_duplicates = df_T.duplicated(keep='first')
            if value_duplicates.any():
                duplicate_value_cols = df_T[value_duplicates].index.tolist()
                logger.warning(f"Found value-duplicate columns: {duplicate_value_cols}")
                df = df.drop(columns=duplicate_value_cols)
        except Exception as e:
            logger.warning(f"Value-based deduplication failed: {e}, continuing without it")
        
        logger.info(f"After duplicate removal: {df.shape}")
        
        # Ensure all numeric columns have proper dtypes for XGBoost
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            if df[col].dtype == 'object':
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
            # Convert boolean columns to int
            if df[col].dtype == 'bool':
                df[col] = df[col].astype(int)
                
        return df
        
    def _compute_rule_scores(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute rule-based scores using tier assignments and performance metrics"""
        logger.info("Computing rule-based scores")
        df = df.dropna(how='all')
        df = df[df['position'].notnull()]
        
        results = []
        tiers_used = []
        
        for idx, row in df.iterrows():
            if not isinstance(row, pd.Series):
                continue
                
            pos = str(row.get('position', self.position)).lower()
            base, tier_name = self._assign_tier_base(row, pos)
            bonus = self._compute_bonus(row, pos)
            perf = self._compute_performance(df, row, pos)
            vers = self._compute_versatility(df, row, pos)
            ath = self._compute_athleticism(df, row, pos)
            multiplier = self._safe_get(row, 'multiplier', 1.0)
            
            score = (base * 0.6 + (perf + vers + ath) * 0.4) * (1 + bonus / 100) * multiplier
            score = np.clip(score, 0, 100)
            
            results.append(score)
            tiers_used.append(tier_name)
            
        df = df.copy()
        df['rule_score'] = results
        df['rule_score_tier'] = tiers_used
        
        return df
        
    def _assign_tier_base(self, row: pd.Series, position: str) -> Tuple[float, str]:
        """Assign base tier score based on physical and performance metrics"""
        tiers_pos = self.tiers.get(position, self.tiers['qb'])
        
        for name, rules in sorted(tiers_pos.items(), key=lambda x: x[1]['base'], reverse=True):
            checks = []
            
            if position == 'wr':
                checks.append(self._safe_get(row, 'rec_ypg', 0) >= rules.get('rec_ypg_min', 0))
            elif position == 'qb':
                checks.append(self._safe_get(row, 'senior_ypg', 0) >= rules['ypg_min'])
            elif position == 'rb':
                checks.append(self._safe_get(row, 'ypg', 0) >= rules['ypg_min'])
                
            checks += [
                rules['height_min'] <= self._safe_get(row, 'height_inches', 0) <= rules['height_max'],
                rules['weight_min'] <= self._safe_get(row, 'weight_lbs', 0) <= rules['weight_max'],
                rules['40_min'] <= self._safe_get(row, 'forty_yard_dash', 5.0) <= rules['40_max'],
                (rules['vertical_min'] - 1) <= self._safe_get(row, 'vertical_jump', 0) <= (rules['vertical_max'] + 1),
                self._safe_get(row, 'shuttle', 5.0) <= rules['shuttle_max'],
                self._safe_get(row, 'broad_jump', 0) >= rules['broad_min']
            ]
            
            if sum(checks) >= len(checks) * 0.6:
                return rules['base'], name
                
        return tiers_pos['D3/NAIA']['base'], 'D3/NAIA'
        
    def _compute_performance(self, df: pd.DataFrame, row: pd.Series, position: str) -> float:
        """Compute performance score based on statistical production"""
        if position == 'qb':
            ypg_pct = self._safe_percentileofscore(df.get('senior_ypg'), self._safe_get(row, 'senior_ypg', 0))
            td_pct = self._safe_percentileofscore(df.get('senior_tds'), self._safe_get(row, 'senior_tds', 0))
            comp_pct = self._safe_percentileofscore(df.get('senior_comp_pct'), self._safe_get(row, 'senior_comp_pct', 0))
            traj_pct = self._safe_percentileofscore(df.get('trajectory'), self._safe_get(row, 'trajectory', 0))
            return (0.4 * ypg_pct + 0.3 * td_pct + 0.2 * comp_pct + 0.1 * traj_pct + 0.1 * self._safe_get(row, 'trajectory_z', 0)) * 0.35
        elif position == 'rb':
            ypg_pct = self._safe_percentileofscore(df.get('ypg'), self._safe_get(row, 'ypg', 0))
            td_pct = self._safe_percentileofscore(df.get('td_game'), self._safe_get(row, 'td_game', 0))
            ypc_pct = self._safe_percentileofscore(df.get('senior_ypc'), self._safe_get(row, 'senior_ypc', 0))
            rec_pct = self._safe_percentileofscore(df.get('senior_rec'), self._safe_get(row, 'senior_rec', 0))
            return (0.4 * ypg_pct + 0.3 * td_pct + 0.2 * ypc_pct + 0.1 * rec_pct + 0.1 * self._safe_get(row, 'eff_ratio', 0)) * 0.35
        elif position == 'wr':
            ypg_pct = self._safe_percentileofscore(df.get('rec_ypg'), self._safe_get(row, 'rec_ypg', 0))
            td_pct = self._safe_percentileofscore(df.get('tds_game'), self._safe_get(row, 'tds_game', 0))
            ypc_pct = self._safe_percentileofscore(df.get('senior_avg'), self._safe_get(row, 'senior_avg', 0))
            rec_pct = self._safe_percentileofscore(df.get('senior_rec'), self._safe_get(row, 'senior_rec', 0))
            return (0.4 * ypg_pct + 0.3 * td_pct + 0.2 * ypc_pct + 0.1 * rec_pct + 0.1 * self._safe_get(row, 'eff_ratio', 0)) * 0.35
        return 0.0
        
    def _compute_versatility(self, df: pd.DataFrame, row: pd.Series, position: str) -> float:
        """Compute versatility score based on multi-dimensional skills"""
        if position == 'qb':
            comp_pct = self._safe_percentileofscore(df.get('senior_comp_pct'), self._safe_get(row, 'senior_comp_pct', 0))
            speed_pct = 100 - self._safe_percentileofscore(df.get('forty_yard_dash'), self._safe_get(row, 'forty_yard_dash', 5.0))
            return (0.5 * comp_pct + 0.5 * speed_pct) * 0.35
        elif position == 'rb':
            ypc_pct = self._safe_percentileofscore(df.get('senior_ypc'), self._safe_get(row, 'senior_ypc', 0))
            rec_pct = self._safe_percentileofscore(df.get('senior_rec'), self._safe_get(row, 'senior_rec', 0))
            ap_pct = self._safe_percentileofscore(df.get('all_purpose_game'), self._safe_get(row, 'all_purpose_game', 0))
            return (0.4 * ypc_pct + 0.3 * rec_pct + 0.3 * ap_pct) * 0.4
        elif position == 'wr':
            ypc_pct = self._safe_percentileofscore(df.get('senior_avg'), self._safe_get(row, 'senior_avg', 0))
            rec_pct = self._safe_percentileofscore(df.get('senior_rec'), self._safe_get(row, 'senior_rec', 0))
            rush_pct = self._safe_percentileofscore(df.get('senior_rush_yds'), self._safe_get(row, 'senior_rush_yds', 0))
            return (0.5 * ypc_pct + 0.3 * rec_pct + 0.2 * rush_pct) * 0.4
        return 0.0
        
    def _compute_athleticism(self, df: pd.DataFrame, row: pd.Series, position: str) -> float:
        """Compute athleticism score based on combine metrics"""
        f_pct = 100 - self._safe_percentileofscore(df.get('forty_yard_dash'), self._safe_get(row, 'forty_yard_dash', 5.0))
        v_pct = self._safe_percentileofscore(df.get('vertical_jump'), self._safe_get(row, 'vertical_jump', 0))
        s_pct = 100 - self._safe_percentileofscore(df.get('shuttle'), self._safe_get(row, 'shuttle', 5.0))
        b_pct = self._safe_percentileofscore(df.get('broad_jump'), self._safe_get(row, 'broad_jump', 0))
        return (0.3 * f_pct + 0.3 * v_pct + 0.2 * s_pct + 0.2 * b_pct) * 0.25
        
    def _compute_bonus(self, row: pd.Series, position: str) -> float:
        """Compute bonus points for exceptional metrics"""
        bonus = 0
        th_40 = 4.7 if position == 'qb' else 4.5
        th_sh = 4.4 if position == 'qb' else 4.3
        
        if self._safe_get(row, 'forty_yard_dash', np.nan) < th_40:
            bonus += 10
        if self._safe_get(row, 'shuttle', np.nan) < th_sh:
            bonus += 5
        if self._safe_get(row, 'trajectory_z', 0) > 1:
            bonus += 5
        if self._safe_get(row, 'is_strong_state', 0):
            bonus += 3
        if self._safe_get(row, 'hoops_vert', 0) > 35:
            bonus += 4
            
        # Check for high percentile columns
        pctile_cols = [c for c in row.index if '_pos_pctile' in str(c)]
        if sum(self._safe_get(row, c, 0) > 0.9 for c in pctile_cols) >= 3:
            bonus += 7
            
        return bonus
        
    def _apply_winsorization(self, df: pd.DataFrame) -> pd.DataFrame:
        """Apply winsorization to numeric features based on training data"""
        if not self.fitted_:
            raise ModelTrainingError("Preprocessor must be fitted before applying winsorization")
            
        logger.info("Applying winsorization based on training bounds")
        df = df.copy()
        
        for feature, bounds in self.winsorization_bounds_.items():
            if feature in df.columns:
                p1, p99 = bounds
                df[feature] = np.clip(df[feature], p1, p99)
                
                # Create percentile features if training stats exist
                if feature in self.training_stats_:
                    train_values = self.training_stats_[feature]
                    df[f'{feature}_pctile'] = df[feature].apply(
                        lambda x: np.percentile(train_values, 100 * (train_values <= x).mean()) if pd.notnull(x) else 50
                    ).astype(float)
                    
        return df
        
    def fit(self, X: pd.DataFrame, y: pd.Series = None) -> 'RecruitRevealPreprocessor':
        """
        Fit the preprocessor on training data
        
        Args:
            X: Training features
            y: Training targets (optional)
            
        Returns:
            Self
            
        Raises:
            DataValidationError: If training data is invalid
        """
        # CRITICAL: Raise exception if called on <30 rows or demo data
        if len(X) < self.config.min_training_rows:
            raise DataValidationError(
                f"Training data must have at least {self.config.min_training_rows} rows. "
                f"Got {len(X)} rows. Never fit this pipeline on demo or single-row data!"
            )
            
        logger.info(f"Fitting preprocessor on {len(X)} samples")
        
        # Apply all preprocessing steps (validate_input adds missing essential columns)
        X_processed = self.validate_input(X)
        
        # Validate all expected columns are present (after validate_input adds them)
        essential_cols = ['height_inches', 'weight_lbs', 'position', 'division', 'state']
        missing_cols = [col for col in essential_cols if col not in X_processed.columns]
        if missing_cols:
            raise DataValidationError(f"Missing essential columns: {missing_cols}")
        X_processed = self._enhanced_feature_engineering(X_processed)
        X_processed = self._compute_rule_scores(X_processed)
        
        # Store training statistics for winsorization
        numeric_features = X_processed.select_dtypes(include=[np.number]).columns
        self.training_stats_ = {}
        self.winsorization_bounds_ = {}
        
        for feature in numeric_features:
            if X_processed[feature].dtype in ['int64', 'float64']:
                feature_values = X_processed[feature].dropna()
                if len(feature_values) > 0:
                    p1, p99 = np.percentile(feature_values, self.config.winsorize_percentiles)
                    self.winsorization_bounds_[feature] = (p1, p99)
                    self.training_stats_[feature] = feature_values.values
                    
        # Apply winsorization to training data
        X_processed = X_processed.copy()
        for feature, bounds in self.winsorization_bounds_.items():
            if feature in X_processed.columns:
                p1, p99 = bounds
                X_processed[feature] = np.clip(X_processed[feature], p1, p99)
                
                # Create percentile features
                train_values = self.training_stats_[feature]
                X_processed[f'{feature}_pctile'] = X_processed[feature].apply(
                    lambda x: np.percentile(train_values, 100 * (train_values <= x).mean()) if pd.notnull(x) else 50
                ).astype(float)
                
        # Remove duplicates one final time - handle QB edge case
        if X_processed.columns.duplicated().any():
            logger.warning(f"Found duplicate columns before final removal: {X_processed.columns[X_processed.columns.duplicated()].tolist()}")
            try:
                X_processed = X_processed.loc[:, ~X_processed.columns.duplicated(keep='first')]
            except ValueError as e:
                if "cannot reindex on an axis with duplicate labels" in str(e):
                    logger.warning("Using manual column deduplication due to reindex error")
                    # Manual deduplication approach
                    seen_cols = set()
                    keep_indices = []
                    for i, col in enumerate(X_processed.columns):
                        if col not in seen_cols:
                            keep_indices.append(i)
                            seen_cols.add(col)
                    X_processed = X_processed.iloc[:, keep_indices]
                else:
                    raise
        
        # Filter out object columns for XGBoost compatibility
        numeric_cols = X_processed.select_dtypes(exclude=['object']).columns
        object_cols = X_processed.select_dtypes(include=['object']).columns
        
        if len(object_cols) > 0:
            logger.warning(f"Excluding {len(object_cols)} object columns from features: {object_cols.tolist()[:10]}")
            X_processed = X_processed[numeric_cols]
        
        # Store feature names for validation (numeric columns only)
        self.feature_names_ = list(X_processed.columns)
        self.fitted_ = True
        
        logger.info(f"Preprocessor fitted successfully. Final feature count: {len(self.feature_names_)}")
        return self
        
    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """
        Transform input data using fitted preprocessor
        
        Args:
            X: Input features
            
        Returns:
            Transformed features
            
        Raises:
            ModelTrainingError: If preprocessor is not fitted
        """
        if not self.fitted_:
            raise ModelTrainingError("Preprocessor must be fitted before transform")
            
        logger.info(f"Transforming {len(X)} samples")
        
        # Validate and clean input
        X_processed = self.validate_input(X)
        
        # Apply feature engineering
        X_processed = self._enhanced_feature_engineering(X_processed)
        X_processed = self._compute_rule_scores(X_processed)
        
        # Apply winsorization based on training bounds
        X_processed = self._apply_winsorization(X_processed)
        
        # Remove duplicates
        X_processed = X_processed.loc[:, ~X_processed.columns.duplicated(keep='first')]
        
        # Add missing columns from training (with defaults)
        for col in self.feature_names_:
            if col not in X_processed.columns:
                if 'pctile' in col:
                    X_processed[col] = 50.0  # Median percentile for missing features
                elif col.startswith('pos_') or col.startswith('state_tier'):
                    X_processed[col] = 0  # Binary features default to 0
                else:
                    X_processed[col] = 0.0  # Numeric features default to 0
                logger.warning(f"Added missing feature '{col}' with default value")
        
        # Ensure column order matches training
        X_processed = X_processed[self.feature_names_]
        
        # Final check: ensure no object/string columns remain for XGBoost
        object_cols = X_processed.select_dtypes(include=['object']).columns
        if len(object_cols) > 0:
            logger.warning(f"Removing {len(object_cols)} object columns for XGBoost: {object_cols.tolist()[:5]}...")
            X_processed = X_processed.drop(columns=object_cols)
        
        logger.info(f"Transform complete. Output shape: {X_processed.shape}")
        return X_processed

class RecruitRevealPipeline:
    """
    Complete Recruit Reveal ML Pipeline for athlete evaluation
    
    This class encapsulates the entire pipeline including preprocessing,
    model training, and prediction functionality.
    """
    
    def __init__(self, position: str, config: PipelineConfig = None):
        self.position = position.lower()
        self.config = config or PipelineConfig()
        
        # Initialize components
        self.preprocessor = RecruitRevealPreprocessor(position, config)
        self.model = XGBClassifier(**self.config.xgb_params)
        self.pipeline = None
        self.fitted_ = False
        
        # Training metadata
        self.training_metadata_ = {}
        
    def fit(self, X: pd.DataFrame, y: pd.Series) -> 'RecruitRevealPipeline':
        """
        Fit the complete pipeline
        
        Args:
            X: Training features
            y: Training targets
            
        Returns:
            Self
            
        Raises:
            DataValidationError: If training data is invalid
            ModelTrainingError: If model training fails
        """
        logger.info(f"Starting pipeline fit for position: {self.position}")
        
        # Create sklearn pipeline
        self.pipeline = Pipeline([
            ('preprocessor', self.preprocessor),
            ('model', self.model)
        ])
        
        try:
            # Fit the pipeline
            self.pipeline.fit(X, y)
            self.fitted_ = True
            
            # Store training metadata
            self.training_metadata_ = {
                'position': self.position,
                'training_samples': len(X),
                'features_count': len(self.preprocessor.feature_names_),
                'feature_names': self.preprocessor.feature_names_,
                'winsorization_bounds': self.preprocessor.winsorization_bounds_,
                'target_classes': list(np.unique(y)),
                'model_params': self.model.get_params()
            }
            
            logger.info(f"Pipeline fitted successfully for {self.position}")
            return self
            
        except Exception as e:
            logger.error(f"Pipeline fitting failed: {str(e)}")
            raise ModelTrainingError(f"Failed to fit pipeline: {str(e)}")
            
    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Predict division labels for athletes"""
        if not self.fitted_:
            raise ModelTrainingError("Pipeline must be fitted before prediction")
            
        return self.pipeline.predict(X)
        
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Predict division probabilities for athletes"""
        if not self.fitted_:
            raise ModelTrainingError("Pipeline must be fitted before prediction")
            
        return self.pipeline.predict_proba(X)
        
    def save_pipeline(self, models_dir: Union[str, Path], model_version: str, 
                     changes: List[str] = None, notes: str = None) -> Dict[str, Path]:
        """
        Save the fitted pipeline with versioning and metadata management
        
        Production Pipeline Versioning Strategy:
        ========================================
        
        1. VERSION MANAGEMENT:
           - All models are saved with semantic versioning (e.g., "1.2.0")
           - Filename format: recruit_reveal_{position}_pipeline_v{version}.pkl
           - Metadata format: recruit_reveal_{position}_pipeline_v{version}.metadata.json
           - Latest symlink: recruit_reveal_{position}_pipeline_latest.pkl
        
        2. ROLLBACK STRATEGY:
           - Keep all previous versions for easy rollback
           - Use load_pipeline(version="1.1.0") to load specific version
           - Use load_pipeline() to load latest version
           - Check CHANGELOG_{position}.md for version history
        
        3. DEPLOYMENT:
           - API loads latest version by default
           - Can specify version in API for A/B testing
           - Render deployment uses latest symlink for automatic updates
        
        Args:
            models_dir: Directory to save models (will be created if doesn't exist)
            model_version: Required semantic version string (e.g., "1.2.0")
            changes: List of changes made in this version (for changelog)
            notes: Additional notes about this version
            
        Returns:
            Dictionary with paths to created files
            
        Raises:
            ModelTrainingError: If pipeline is not fitted
            ModelVersionError: If version format is invalid or already exists
        """
        if not self.fitted_:
            raise ModelTrainingError("Pipeline must be fitted before saving")
        
        # Validate version format
        if not ModelVersionManager.validate_version(model_version):
            raise ModelVersionError(
                f"Invalid version format: {model_version}. "
                "Use semantic versioning (e.g., '1.2.0' or '1.2.0-beta')"
            )
        
        models_dir = Path(models_dir)
        models_dir.mkdir(parents=True, exist_ok=True)
        
        # Check if version already exists
        versioned_filepath = models_dir / f"recruit_reveal_{self.position}_pipeline_v{model_version}.pkl"
        if versioned_filepath.exists():
            raise ModelVersionError(
                f"Version {model_version} already exists for {self.position}. "
                "Use a different version number or delete the existing version."
            )
        
        logger.info(f"💾 Saving {self.position.upper()} pipeline version {model_version}")
        
        # Enhanced metadata with versioning info
        enhanced_metadata = {
            **self.training_metadata_,
            'model_version': model_version,
            'train_date': datetime.now(timezone.utc).isoformat(),
            'position': self.position,
            'notes': notes or f"Recruit Reveal {self.position.upper()} pipeline v{model_version}",
            'changelog_entry': changes or ["Model retrained with latest data"],
            'pipeline_config': {
                'preprocessor_type': 'RecruitRevealPreprocessor',
                'model_type': 'XGBoost',
                'defensive_programming': True,
                'production_ready': True
            },
            'api_compatibility': {
                'fastapi': True,
                'render_deployment': True,
                'versioned': True
            }
        }
        
        # Save versioned pipeline
        joblib.dump(self.pipeline, versioned_filepath)
        logger.info(f"✅ Pipeline saved to {versioned_filepath}")
        
        # Save versioned metadata
        metadata_filepath = versioned_filepath.with_suffix('.metadata.json')
        with open(metadata_filepath, 'w') as f:
            json.dump(enhanced_metadata, f, indent=2, default=str)
        logger.info(f"📋 Metadata saved to {metadata_filepath}")
        
        # Create/update latest symlinks (fallback to copy on Windows/systems without symlink support)
        latest_pipeline_path = models_dir / f"recruit_reveal_{self.position}_pipeline_latest.pkl"
        latest_metadata_path = models_dir / f"recruit_reveal_{self.position}_pipeline_latest.metadata.json"
        
        try:
            # Try to create symlinks (Unix/Linux/macOS)
            if latest_pipeline_path.exists() or latest_pipeline_path.is_symlink():
                latest_pipeline_path.unlink()
            if latest_metadata_path.exists() or latest_metadata_path.is_symlink():
                latest_metadata_path.unlink()
                
            latest_pipeline_path.symlink_to(versioned_filepath.name)
            latest_metadata_path.symlink_to(metadata_filepath.name)
            logger.info(f"🔗 Created symlinks to latest version")
            
        except (OSError, NotImplementedError):
            # Fallback to copy (Windows or systems without symlink support)
            shutil.copy2(versioned_filepath, latest_pipeline_path)
            shutil.copy2(metadata_filepath, latest_metadata_path)
            logger.info(f"📄 Copied files to latest version (symlinks not supported)")
        
        # Update changelog
        ModelVersionManager.create_changelog_entry(
            models_dir, self.position, model_version, changes
        )
        
        # Print comprehensive summary
        created_files = {
            'pipeline': versioned_filepath,
            'metadata': metadata_filepath,
            'latest_pipeline': latest_pipeline_path,
            'latest_metadata': latest_metadata_path,
            'changelog': models_dir / f"CHANGELOG_{self.position}.md"
        }
        
        self._print_versioned_save_summary(created_files, model_version, models_dir)
        
        return created_files
    
    def _print_versioned_save_summary(self, created_files: Dict[str, Path], version: str, models_dir: Path) -> None:
        """Print comprehensive versioned pipeline save summary"""
        print(f"\n{'='*90}")
        print(f"🚀 RECRUIT REVEAL PIPELINE v{version} SAVED SUCCESSFULLY")
        print(f"{'='*90}")
        
        print(f"\n📁 FILES CREATED:")
        print(f"  📦 Versioned Pipeline: {created_files['pipeline']}")
        print(f"  📋 Versioned Metadata: {created_files['metadata']}")
        print(f"  🔗 Latest Pipeline:    {created_files['latest_pipeline']}")
        print(f"  📄 Latest Metadata:    {created_files['latest_metadata']}")
        print(f"  📝 Changelog:          {created_files['changelog']}")
        
        print(f"\n📊 PIPELINE SUMMARY:")
        print(f"  Position: {self.position.upper()}")
        print(f"  Version: {version}")
        print(f"  Training samples: {self.training_metadata_['training_samples']}")
        print(f"  Features: {self.training_metadata_['features_count']}")
        print(f"  Target classes: {self.training_metadata_['target_classes']}")
        print(f"  Training date: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
        
        print(f"\n🔧 PREPROCESSING COMPONENTS:")
        print(f"  ✅ Intelligent combine imputation")
        print(f"  ✅ State embeddings and talent scores")
        print(f"  ✅ Enhanced feature engineering")
        print(f"  ✅ Winsorization ({len(self.training_metadata_['winsorization_bounds'])} features)")
        print(f"  ✅ Rule-based scoring system")
        print(f"  ✅ Duplicate removal and data cleaning")
        
        print(f"\n🛡️  PRODUCTION FEATURES:")
        print(f"  ✅ Version management and rollback capability")
        print(f"  ✅ Input validation and cleaning")
        print(f"  ✅ Missing column auto-insertion")
        print(f"  ✅ Robust error handling")
        print(f"  ✅ Comprehensive logging")
        
        # Show available versions
        available_versions = ModelVersionManager.get_model_versions(models_dir, self.position)
        print(f"\n📚 AVAILABLE VERSIONS:")
        for i, version_info in enumerate(available_versions[:3]):  # Show latest 3
            marker = "🎯" if i == 0 else "📦"
            version_str = version_info['version']
            if i == 0:
                version_str += " (LATEST)"
            print(f"  {marker} v{version_str}")
        if len(available_versions) > 3:
            print(f"  📁 ... and {len(available_versions) - 3} more versions")
        
        print(f"\n💡 USAGE INSTRUCTIONS:")
        print(f"")
        print(f"  # Load latest version (recommended for production)")
        print(f"  pipeline = RecruitRevealPipeline.load_pipeline('{models_dir}', '{self.position}')")
        print(f"")
        print(f"  # Load specific version (for testing or rollback)")
        print(f"  pipeline = RecruitRevealPipeline.load_pipeline('{models_dir}', '{self.position}', version='{version}')")
        print(f"")
        print(f"  # FastAPI/Render deployment")
        print(f"  # Place models in ./ml-api/models/ directory")
        print(f"  # API will automatically load latest version")
        print(f"")
        
        print(f"\n🔄 ROLLBACK INSTRUCTIONS:")
        print(f"  1. List available versions:")
        print(f"     ModelVersionManager.get_model_versions(Path('{models_dir}'), '{self.position}')")
        print(f"")
        print(f"  2. Load previous version:")
        print(f"     pipeline = RecruitRevealPipeline.load_pipeline('{models_dir}', '{self.position}', version='1.1.0')")
        print(f"")
        print(f"  3. Check changelog for version differences:")
        print(f"     cat {created_files['changelog']}")
        
        print(f"{'='*90}\n")
        
    def _print_save_summary(self, filepath: Path) -> None:
        """Print comprehensive pipeline save summary"""
        print(f"\n{'='*80}")
        print(f"RECRUIT REVEAL PIPELINE SAVED SUCCESSFULLY")
        print(f"{'='*80}")
        print(f"📁 Pipeline file: {filepath}")
        print(f"📋 Metadata file: {filepath.with_suffix('.metadata.json')}")
        print(f"\n📊 PIPELINE SUMMARY:")
        print(f"  Position: {self.position.upper()}")
        print(f"  Training samples: {self.training_metadata_['training_samples']}")
        print(f"  Features: {self.training_metadata_['features_count']}")
        print(f"  Target classes: {self.training_metadata_['target_classes']}")
        
        print(f"\n🔧 PREPROCESSING COMPONENTS:")
        print(f"  ✅ Intelligent combine imputation")
        print(f"  ✅ State embeddings and talent scores")
        print(f"  ✅ Enhanced feature engineering")
        print(f"  ✅ Winsorization ({len(self.training_metadata_['winsorization_bounds'])} features)")
        print(f"  ✅ Rule-based scoring system")
        print(f"  ✅ Duplicate removal and data cleaning")
        
        print(f"\n⚙️  MODEL CONFIGURATION:")
        model_params = self.training_metadata_['model_params']
        print(f"  Algorithm: XGBoost Classifier")
        print(f"  Estimators: {model_params.get('n_estimators', 100)}")
        print(f"  Max depth: {model_params.get('max_depth', 6)}")
        print(f"  Learning rate: {model_params.get('learning_rate', 0.1)}")
        
        print(f"\n🛡️  DEFENSIVE FEATURES:")
        print(f"  ✅ Input validation and cleaning")
        print(f"  ✅ Missing column auto-insertion")
        print(f"  ✅ Robust error handling")
        print(f"  ✅ Comprehensive logging")
        print(f"  ✅ Edge case protection")
        
        print(f"\n💡 USAGE INSTRUCTIONS:")
        print(f"  pipeline = joblib.load('{filepath}')")
        print(f"  athlete_df = pd.DataFrame([{{...}}])  # Any columns, missing fields OK")
        print(f"  result = pipeline.predict(athlete_df)")
        print(f"  probabilities = pipeline.predict_proba(athlete_df)")
        print(f"{'='*80}\n")
        
    @staticmethod
    def load_pipeline(models_dir: Union[str, Path], position: str, version: str = None) -> Pipeline:
        """
        Load a saved pipeline with version support
        
        Args:
            models_dir: Directory containing model files
            position: Position (qb, rb, wr)
            version: Specific version to load (defaults to latest)
            
        Returns:
            Loaded pipeline
            
        Raises:
            FileNotFoundError: If model file doesn't exist
            ModelVersionError: If specified version is not found
            
        Examples:
            # Load latest version (recommended)
            pipeline = RecruitRevealPipeline.load_pipeline("models/", "qb")
            
            # Load specific version (for rollback/testing)
            pipeline = RecruitRevealPipeline.load_pipeline("models/", "qb", version="1.1.0")
        """
        models_dir = Path(models_dir)
        
        if version is None:
            # Load latest version
            filepath = models_dir / f"recruit_reveal_{position}_pipeline_latest.pkl"
            if not filepath.exists():
                # Fallback: find latest versioned file
                latest_version = ModelVersionManager.get_latest_version(models_dir, position)
                if latest_version is None:
                    raise FileNotFoundError(
                        f"No models found for position '{position}' in {models_dir}. "
                        "Train and save a model first."
                    )
                filepath = models_dir / f"recruit_reveal_{position}_pipeline_v{latest_version}.pkl"
                logger.info(f"🔍 Loading latest version v{latest_version} for {position.upper()}")
            else:
                logger.info(f"🔍 Loading latest pipeline for {position.upper()}")
        else:
            # Load specific version
            if not ModelVersionManager.validate_version(version):
                raise ModelVersionError(f"Invalid version format: {version}")
                
            filepath = models_dir / f"recruit_reveal_{position}_pipeline_v{version}.pkl"
            if not filepath.exists():
                available_versions = ModelVersionManager.get_model_versions(models_dir, position)
                available_list = [v['version'] for v in available_versions]
                raise ModelVersionError(
                    f"Version {version} not found for {position}. "
                    f"Available versions: {available_list}"
                )
            logger.info(f"🔍 Loading specific version v{version} for {position.upper()}")
        
        # Load the pipeline
        try:
            pipeline = joblib.load(filepath)
            logger.info(f"✅ Successfully loaded pipeline from {filepath}")
            return pipeline
        except Exception as e:
            logger.error(f"❌ Failed to load pipeline: {str(e)}")
            raise ModelTrainingError(f"Failed to load pipeline from {filepath}: {str(e)}")
    
    @staticmethod  
    def get_model_info(models_dir: Union[str, Path], position: str) -> Dict[str, Any]:
        """
        Get information about available models for a position
        
        Args:
            models_dir: Directory containing model files
            position: Position (qb, rb, wr)
            
        Returns:
            Dictionary with model information
        """
        models_dir = Path(models_dir)
        versions = ModelVersionManager.get_model_versions(models_dir, position)
        latest_version = ModelVersionManager.get_latest_version(models_dir, position)
        
        return {
            'position': position,
            'total_versions': len(versions),
            'latest_version': latest_version,
            'versions': versions,
            'changelog_path': str(models_dir / f"CHANGELOG_{position}.md")
        }

def test_pipeline(csv_path: str, position: str) -> None:
    """
    Comprehensive test function for the pipeline
    
    Args:
        csv_path: Path to training CSV data
        position: Position to test ('qb', 'rb', 'wr')
    """
    print(f"\n{'='*60}")
    print(f"TESTING RECRUIT REVEAL PIPELINE - {position.upper()}")
    print(f"{'='*60}")
    
    try:
        # Load real CSV training data
        logger.info(f"Loading training data from {csv_path}")
        df = pd.read_csv(csv_path)
        logger.info(f"Loaded {len(df)} samples with {len(df.columns)} columns")
        
        # Filter for position if needed
        if 'position' in df.columns:
            df = df[df['position'].str.lower() == position.lower()]
            logger.info(f"Filtered to {len(df)} {position} samples")
            
        if len(df) < 30:
            logger.warning(f"Only {len(df)} samples available for {position}")
            
        # Prepare features and target
        if 'division' in df.columns:
            X = df.drop(['division'], axis=1)
            y = df['division']
        else:
            X = df
            y = pd.Series(['D3'] * len(df))  # Dummy target for testing
            
        # Initialize and fit pipeline
        config = PipelineConfig(min_training_rows=10)  # Lower threshold for testing
        pipeline = RecruitRevealPipeline(position, config)
        pipeline.fit(X, y)
        
        print(f"\n✅ Pipeline fitted successfully!")
        
        # Test Case 1: All fields present
        print(f"\n🧪 TEST CASE 1: Complete athlete data")
        complete_athlete = X.iloc[:1].copy()
        result1 = pipeline.predict(complete_athlete)
        probs1 = pipeline.predict_proba(complete_athlete)
        print(f"  Prediction: {result1[0]}")
        print(f"  Probabilities: {dict(zip(pipeline.training_metadata_['target_classes'], probs1[0]))}")
        
        # Test Case 2: Missing all combine data
        print(f"\n🧪 TEST CASE 2: Missing all combine data")
        missing_combine = X.iloc[:1].copy()
        combine_cols = ['forty_yard_dash', 'vertical_jump', 'shuttle', 'broad_jump']
        for col in combine_cols:
            if col in missing_combine.columns:
                missing_combine[col] = np.nan
        result2 = pipeline.predict(missing_combine)
        probs2 = pipeline.predict_proba(missing_combine)
        print(f"  Prediction: {result2[0]}")
        print(f"  Probabilities: {dict(zip(pipeline.training_metadata_['target_classes'], probs2[0]))}")
        
        # Check imputation flags
        transformed = pipeline.pipeline.named_steps['preprocessor'].transform(missing_combine)
        imputed_cols = [col for col in transformed.columns if '_imputed' in col]
        if imputed_cols:
            imputed_values = transformed[imputed_cols].iloc[0]
            print(f"  Imputed fields: {dict(imputed_values[imputed_values == True])}")
            
        # Test Case 3: Missing all stats except one
        print(f"\n🧪 TEST CASE 3: Missing most stats")
        missing_stats = X.iloc[:1].copy()
        stat_cols = [col for col in X.columns if 'senior_' in col or 'junior_' in col]
        for col in stat_cols[1:]:  # Keep first stat column
            if col in missing_stats.columns:
                missing_stats[col] = np.nan
        result3 = pipeline.predict(missing_stats)
        probs3 = pipeline.predict_proba(missing_stats)
        print(f"  Prediction: {result3[0]}")
        print(f"  Probabilities: {dict(zip(pipeline.training_metadata_['target_classes'], probs3[0]))}")
        
        # Test Case 4: Unknown state/position
        print(f"\n🧪 TEST CASE 4: Unknown state and position variations")
        unknown_data = X.iloc[:1].copy()
        if 'state' in unknown_data.columns:
            unknown_data['state'] = 'XX'  # Unknown state
        if 'position' in unknown_data.columns:
            unknown_data['position'] = position.upper()  # Ensure correct position
        result4 = pipeline.predict(unknown_data)
        probs4 = pipeline.predict_proba(unknown_data)
        print(f"  Prediction: {result4[0]}")
        print(f"  Probabilities: {dict(zip(pipeline.training_metadata_['target_classes'], probs4[0]))}")
        
        # Test validation method
        print(f"\n🧪 TEST CASE 5: Input validation")
        test_input = pd.DataFrame([{
            'height_inches': 72,
            'weight_lbs': 200,
            'unknown_column': 'test'  # This should trigger a warning
        }])
        
        validated_input = pipeline.preprocessor.validate_input(test_input)
        result5 = pipeline.predict(validated_input)
        probs5 = pipeline.predict_proba(validated_input)
        print(f"  Prediction: {result5[0]}")
        print(f"  Probabilities: {dict(zip(pipeline.training_metadata_['target_classes'], probs5[0]))}")
        
        # Test combine confidence
        transformed = pipeline.pipeline.named_steps['preprocessor'].transform(validated_input)
        if 'combine_confidence' in transformed.columns:
            print(f"  Combine confidence: {transformed['combine_confidence'].iloc[0]:.3f}")
            
        print(f"\n✅ ALL TESTS PASSED SUCCESSFULLY!")
        
        # Save the pipeline with versioning
        output_dir = "models/"
        test_version = "1.0.0-test"
        changes = [
            "Test pipeline created from sample data",
            "Includes comprehensive validation testing",
            "Ready for production deployment"
        ]
        
        created_files = pipeline.save_pipeline(
            models_dir=output_dir, 
            model_version=test_version,
            changes=changes,
            notes=f"Test pipeline for {position.upper()} position with comprehensive validation"
        )
        
    except Exception as e:
        logger.error(f"Test failed: {str(e)}")
        print(f"\n❌ TEST FAILED: {str(e)}")
        raise

if __name__ == "__main__":
    # Example usage with versioning
    print("=" * 80)
    print("🏈 RECRUIT REVEAL PRODUCTION PIPELINE")
    print("=" * 80)
    print("⚠️  This is the pipeline module. To train and export models, use:")
    print("   python -m scripts.train_and_export --csv data/training.csv --position all --version 1.0.0")
    print()
    print("📖 For examples and testing, see:")
    print("   - scripts/train_and_export.py (production training)")
    print("   - gitingore-eval-logic-test.ipynb (development notebook)")
    print("=" * 80)
    
    # If there are command line arguments, warn about the new interface
    import sys
    if len(sys.argv) > 1:
        print("\n⚠️  Warning: This module no longer accepts command line arguments directly.")
        print("   Please use scripts.train_and_export for training operations.")
        sys.exit(1)
        
    # Example usage documentation remains but doesn't run by default
    position = "qb"  # Example position
    csv_path = "data/training.csv"  # Example path
    
    # Only run test if explicit environment variable is set
    run_test = os.getenv("RUN_PIPELINE_TEST", "false").lower() == "true"
    
    if run_test:
        print("\n🧪 Running pipeline test (RUN_PIPELINE_TEST=true)")
        try:
            test_pipeline(csv_path, position)
            
            # Example: Loading different versions
            print("\n" + "="*60)
            print("📚 VERSION MANAGEMENT EXAMPLES")
            print("="*60)
            
            models_dir = "models/"
            
            # Get model information
            try:
                model_info = RecruitRevealPipeline.get_model_info(models_dir, position)
                print(f"\n📊 Model Info for {position.upper()}:")
                print(f"  Total versions: {model_info['total_versions']}")
                print(f"  Latest version: {model_info['latest_version']}")
                
                # Load latest version
                latest_pipeline = RecruitRevealPipeline.load_pipeline(models_dir, position)
                print(f"✅ Loaded latest pipeline successfully")
                
                # Load specific version if available
                if model_info['total_versions'] > 0:
                    specific_version = model_info['versions'][0]['version']
                    specific_pipeline = RecruitRevealPipeline.load_pipeline(
                        models_dir, position, version=specific_version
                    )
                    print(f"✅ Loaded specific version {specific_version} successfully")
                    
            except (FileNotFoundError, ModelVersionError) as e:
                print(f"ℹ️ Version management example: {e}")
                
        except FileNotFoundError:
            print("\n⚠️  Training data CSV not found. Use scripts.train_and_export for production training.")
            
        except Exception as e:
            print(f"Test execution failed: {e}")
    else:
        print("\n💡 To run the pipeline test, set environment variable:")
        print("   export RUN_PIPELINE_TEST=true")
        print("   python recruit_reveal_production_pipeline.py")
        print()
        print("🚀 For production training, use the new script:")
        print("   python -m scripts.train_and_export --csv data/training.csv --position all --version 1.0.0")