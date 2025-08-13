#!/usr/bin/env python3
"""
Shared preprocessing pipeline for Recruit Reveal ML API
Contains production-ready feature engineering with 76+ features
"""

import pandas as pd
import numpy as np
import logging
from typing import Dict, Any, Optional, Tuple, List
from scipy.stats import percentileofscore

logger = logging.getLogger(__name__)

# Production target mapping (critical for accuracy)
TARGET_MAP = {
    'POWER 5': 3, 'Power 5': 3, 'power 5': 3, 'POWER5': 3,
    'FCS': 2, 'fcs': 2,
    'D2': 1, 'd2': 1,
    'D3': 0, 'd3': 0,
    'NAIA': 0, 'naia': 0
}

# Combine benchmarks for intelligent imputation
COMBINE_BENCHMARKS = {
    'qb': {
        'POWER 5': {'forty_yard_dash': (4.75, 0.08), 'vertical_jump': (32.00, 1.00), 'shuttle': (4.45, 0.07), 'broad_jump': (113.00, 2.50)},
        'FCS': {'forty_yard_dash': (4.85, 0.07), 'vertical_jump': (30.00, 1.00), 'shuttle': (4.55, 0.07), 'broad_jump': (107.00, 2.50)},
        'D2': {'forty_yard_dash': (4.95, 0.07), 'vertical_jump': (28.00, 1.00), 'shuttle': (4.65, 0.07), 'broad_jump': (101.00, 2.50)},
        'D3': {'forty_yard_dash': (5.10, 0.10), 'vertical_jump': (26.00, 1.00), 'shuttle': (4.75, 0.08), 'broad_jump': (95.00, 2.50)},
        'NAIA': {'forty_yard_dash': (5.00, 0.10), 'vertical_jump': (27.00, 1.00), 'shuttle': (4.65, 0.07), 'broad_jump': (97.00, 2.50)}
    },
    'rb': {
        'POWER 5': {'forty_yard_dash': (4.35, 0.07), 'vertical_jump': (36.00, 1.00), 'shuttle': (4.15, 0.07), 'broad_jump': (125.00, 2.50)},
        'FCS': {'forty_yard_dash': (4.45, 0.07), 'vertical_jump': (34.00, 1.00), 'shuttle': (4.25, 0.08), 'broad_jump': (115.00, 2.50)},
        'D2': {'forty_yard_dash': (4.55, 0.07), 'vertical_jump': (32.00, 1.00), 'shuttle': (4.35, 0.07), 'broad_jump': (105.00, 2.50)},
        'D3': {'forty_yard_dash': (4.65, 0.07), 'vertical_jump': (30.00, 1.00), 'shuttle': (4.45, 0.07), 'broad_jump': (100.00, 2.50)},
        'NAIA': {'forty_yard_dash': (4.55, 0.07), 'vertical_jump': (31.00, 1.00), 'shuttle': (4.35, 0.07), 'broad_jump': (103.00, 2.50)}
    },
    'wr': {
        'POWER 5': {'forty_yard_dash': (4.55, 0.07), 'vertical_jump': (36.00, 1.00), 'shuttle': (4.25, 0.08), 'broad_jump': (125.00, 2.50)},
        'FCS': {'forty_yard_dash': (4.65, 0.07), 'vertical_jump': (35.00, 1.00), 'shuttle': (4.35, 0.07), 'broad_jump': (115.00, 2.50)},
        'D2': {'forty_yard_dash': (4.75, 0.08), 'vertical_jump': (33.00, 1.00), 'shuttle': (4.45, 0.07), 'broad_jump': (105.00, 2.50)},
        'D3': {'forty_yard_dash': (4.85, 0.07), 'vertical_jump': (31.00, 1.00), 'shuttle': (4.55, 0.07), 'broad_jump': (100.00, 2.50)},
        'NAIA': {'forty_yard_dash': (4.75, 0.08), 'vertical_jump': (32.00, 1.00), 'shuttle': (4.45, 0.07), 'broad_jump': (103.00, 2.50)}
    }
}

# State talent mapping
STATE_TALENT_MAP = {
    'TX': 4, 'FL': 4, 'CA': 4, 'GA': 4,  # Elite
    'OH': 3, 'PA': 3, 'NC': 3, 'VA': 3, 'MI': 3, 'IL': 3, 'LA': 3, 'AL': 3, 
    'TN': 3, 'SC': 3, 'AZ': 3, 'NJ': 3, 'MD': 3,  # Strong
    'IN': 2, 'MO': 2, 'WI': 2, 'MN': 2, 'IA': 2, 'KY': 2, 'OK': 2, 'AR': 2, 
    'MS': 2, 'KS': 2, 'CO': 2, 'OR': 2, 'WA': 2, 'CT': 2, 'NV': 2, 'UT': 2  # Moderate
}

def normalize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize column names to match pipeline expectations"""
    df = df.copy()
    
    # Column name mappings
    column_map = {
        'Height_Inches': 'height_inches',
        'Weight_Lbs': 'weight_lbs',
        'Grad_year': 'grad_year',
        'Senior_Yds': 'senior_yds',
        'Senior_TD_Passes': 'senior_td_passes',
        'Senior_YPG': 'senior_ypg',
        'Senior_Cmp': 'senior_cmp',
        'Senior_Att': 'senior_att',
        'Senior_Int': 'senior_int',
        'Junior_Yds': 'junior_yds',
        'Junior_TD_Passes': 'junior_td_passes',
        'Junior_YPG': 'junior_ypg',
        'Junior_Cmp': 'junior_cmp',
        'Junior_Att': 'junior_att',
        'Junior_Int': 'junior_int',
        'Forty_Yard_Dash': 'forty_yard_dash',
        'Vertical_Jump': 'vertical_jump',
        'Shuttle': 'shuttle',
        'Broad_Jump': 'broad_jump',
        'Division': 'division',
        'State': 'state',
        'Player_Name': 'player_name',
        'College': 'college',
        'High_School': 'high_school'
    }
    
    df = df.rename(columns=column_map)
    return df

def map_division_targets(df: pd.DataFrame) -> pd.DataFrame:
    """Map string divisions to numeric targets"""
    df = df.copy()
    df['target'] = df['division'].map(TARGET_MAP)
    
    # Handle unmapped values
    unmapped = df['target'].isna()
    if unmapped.any():
        logger.warning(f"Found {unmapped.sum()} unmapped divisions, setting to D3 (0)")
        df.loc[unmapped, 'target'] = 0
    
    return df

def intelligent_combine_imputation(df: pd.DataFrame, position: str) -> pd.DataFrame:
    """Intelligent combine imputation using division-specific benchmarks"""
    logger.info(f"Starting intelligent combine imputation for {position}")
    df = df.copy()
    
    # Normalize division for lookup
    df['division_norm'] = df['division'].astype(str).str.upper().replace({'POWER 5': 'POWER 5'})
    
    combine_metrics = ['forty_yard_dash', 'vertical_jump', 'shuttle', 'broad_jump']
    position_benchmarks = COMBINE_BENCHMARKS.get(position.lower(), COMBINE_BENCHMARKS['qb'])
    
    for metric in combine_metrics:
        if metric not in df.columns:
            df[metric] = np.nan
        
        # Convert to numeric
        df[metric] = pd.to_numeric(df[metric], errors='coerce')
        
        # Track imputation
        df[f'{metric}_imputed'] = df[metric].isna().astype(int)
        
        missing_mask = df[metric].isna()
        if missing_mask.any():
            logger.info(f"  Imputing {missing_mask.sum()} missing {metric} values")
            
            # Impute based on division-specific benchmarks
            for division in df['division_norm'].unique():
                if pd.isna(division):
                    continue
                    
                div_mask = (df['division_norm'] == division) & missing_mask
                if not div_mask.any():
                    continue
                
                # Get benchmark for this position/division
                if division in position_benchmarks:
                    mean_val, std_val = position_benchmarks[division][metric]
                else:
                    # Fallback to D3 benchmarks
                    mean_val, std_val = position_benchmarks['D3'][metric]
                
                # Generate realistic values
                n_samples = div_mask.sum()
                np.random.seed(42)  # Reproducible
                imputed_values = np.random.normal(mean_val, std_val, n_samples)
                
                df.loc[div_mask, metric] = imputed_values
                logger.info(f"    {division}: {n_samples} values from N({mean_val:.2f}, {std_val:.2f})")
    
    return df

def create_engineered_features(df: pd.DataFrame, position: str) -> pd.DataFrame:
    """Create 76+ engineered features matching production pipeline"""
    logger.info(f"Starting enhanced feature engineering for {position}")
    df = df.copy()
    
    # Core engineered features
    # 1. Trajectory (must be >= 0)
    if 'senior_ypg' in df.columns and 'junior_ypg' in df.columns:
        df['trajectory'] = np.maximum(df['senior_ypg'].fillna(0) - df['junior_ypg'].fillna(0), 0)
    else:
        df['trajectory'] = 0
    
    # 2. BMI
    if 'weight_lbs' in df.columns and 'height_inches' in df.columns:
        df['bmi'] = (df['weight_lbs'].fillna(180) / (df['height_inches'].fillna(72) ** 2)) * 703
    else:
        df['bmi'] = 25.0  # Default BMI
    
    # 3. Athletic power composite
    df['ath_power'] = (df['vertical_jump'].fillna(30) * df['broad_jump'].fillna(110))
    
    # 4. Speed-power ratio
    df['speed_power_ratio'] = df['ath_power'] / (df['forty_yard_dash'].fillna(4.8) + 1e-6)
    
    # 5. State talent score
    if 'state' not in df.columns:
        df['state'] = 'ZZ'
    df['state_talent_score'] = df['state'].astype(str).str.upper().map(STATE_TALENT_MAP).fillna(1)
    
    # 6. State tier indicators  
    df['state_tier_1'] = (df['state_talent_score'] == 4).astype(int)
    df['state_tier_2'] = (df['state_talent_score'] == 3).astype(int)
    df['state_tier_3'] = (df['state_talent_score'] == 2).astype(int)
    df['state_tier_4'] = (df['state_talent_score'] == 1).astype(int)
    
    # 7. Strong state indicator
    strong_states = {'TX', 'FL', 'CA', 'GA'}
    df['is_strong_state'] = df['state'].astype(str).str.upper().isin(strong_states).astype(int)
    
    # Position-specific features
    if position.lower() == 'qb':
        # Completion percentage
        if 'senior_cmp' in df.columns and 'senior_att' in df.columns:
            df['senior_comp_pct'] = (df['senior_cmp'].fillna(0) / (df['senior_att'].fillna(1) + 1e-6)) * 100
        else:
            df['senior_comp_pct'] = 60.0  # Default
            
        # YPG features
        df['rec_ypg'] = 0  # QBs don't have receiving yards
        df['ypg'] = df['senior_ypg'].fillna(200)
        
        # Position indicators
        df['pos_qb'] = 1
        df['pos_rb'] = 0
        df['pos_wr'] = 0
        
    elif position.lower() == 'rb':
        # YPC (yards per carry)
        if 'senior_yds' in df.columns:
            df['senior_ypc'] = df['senior_yds'].fillna(0) / 100  # Approximate carries
        else:
            df['senior_ypc'] = 4.5  # Default YPC
            
        # Receiving yards per game
        if 'senior_rec_yds' in df.columns:
            df['rec_ypg'] = df['senior_rec_yds'].fillna(0) / df.get('games', pd.Series([12] * len(df)))
        else:
            df['rec_ypg'] = 15.0  # Default receiving YPG
            
        df['ypg'] = df['senior_ypg'].fillna(100)
        
        # Position indicators
        df['pos_qb'] = 0
        df['pos_rb'] = 1
        df['pos_wr'] = 0
        
    elif position.lower() == 'wr':
        # Average yards per reception
        if 'senior_rec_yds' in df.columns and 'senior_rec' in df.columns:
            df['senior_avg'] = df['senior_rec_yds'].fillna(0) / (df['senior_rec'].fillna(1) + 1e-6)
        else:
            df['senior_avg'] = 14.0  # Default average
            
        # Receiving yards per game
        if 'senior_rec_yds' in df.columns:
            df['rec_ypg'] = df['senior_rec_yds'].fillna(0) / df.get('games', pd.Series([12] * len(df)))
        else:
            df['rec_ypg'] = 60.0  # Default receiving YPG
            
        df['ypg'] = df['rec_ypg']
        
        # Position indicators
        df['pos_qb'] = 0
        df['pos_rb'] = 0
        df['pos_wr'] = 1
    
    # Common derived features
    df['games'] = df.get('games', 12)
    df['bmi_ypg'] = df['bmi'] * df['ypg']
    df['height_traj'] = df['height_inches'].fillna(72) * df['trajectory']
    
    # Efficiency ratios
    if position.lower() == 'qb':
        df['comp_ypg'] = df['senior_comp_pct'] * df['ypg'] / 100
        df['height_comp'] = df['height_inches'].fillna(74) * df['senior_comp_pct']
    else:
        df['comp_ypg'] = df['ypg']  # For non-QBs
        df['height_comp'] = df['height_inches'].fillna(70) * 50  # Default value
    
    # Standardized trajectory (z-score)
    if df['trajectory'].std() > 0:
        df['trajectory_z'] = (df['trajectory'] - df['trajectory'].mean()) / df['trajectory'].std()
    else:
        df['trajectory_z'] = 0
    
    # Combine confidence (1.0 - 0.2 * num_imputed_fields)
    imputed_fields = ['forty_yard_dash_imputed', 'vertical_jump_imputed', 'shuttle_imputed', 'broad_jump_imputed']
    total_imputed = sum(df.get(field, 0) for field in imputed_fields if field in df.columns)
    df['combine_confidence'] = np.maximum(1.0 - 0.2 * total_imputed, 0.1)
    
    # Additional performance metrics
    if 'senior_tds' in df.columns or 'senior_td_passes' in df.columns:
        tds = df.get('senior_tds', df.get('senior_td_passes', 10))
        df['tds_game'] = tds / df['games']
    else:
        df['tds_game'] = 1.0
    
    df['td_game'] = df['tds_game']  # Alias
    
    # State efficiency
    df['state_eff'] = df['state_talent_score'] * df['ypg'] / 100
    
    # Speed-related
    if position.lower() == 'rb':
        df['ypc_speed'] = df['senior_ypc'] * (5.0 - df['forty_yard_dash'].fillna(4.5))
    else:
        df['ypc_speed'] = 0
    
    # All-purpose performance
    df['all_purpose_game'] = df['ypg'] + df['rec_ypg']
    
    # Efficiency ratio
    df['eff_ratio'] = df['tds_game'] / (df['ypg'] + 1e-6)
    
    logger.info(f"Enhanced feature engineering completed for {position}")
    return df

def compute_percentile_features(df: pd.DataFrame, training_stats: Optional[Dict] = None) -> pd.DataFrame:
    """Compute percentile-based features for all numeric columns"""
    df = df.copy()
    
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    
    for col in numeric_cols:
        if col.endswith('_pctile') or col in ['target']:
            continue
            
        pctile_col = f'{col}_pctile'
        
        if training_stats and col in training_stats:
            # Use training distribution for inference
            training_values = training_stats[col]
            df[pctile_col] = df[col].apply(lambda x: percentileofscore(training_values, x) if not pd.isna(x) else 0)
        else:
            # Compute from current data (training mode)
            clean_series = df[col].dropna()
            if len(clean_series) > 1:
                df[pctile_col] = df[col].apply(lambda x: percentileofscore(clean_series, x) if not pd.isna(x) else 0)
            else:
                df[pctile_col] = 0
    
    return df

def compute_rule_based_scores(df: pd.DataFrame, position: str) -> pd.DataFrame:
    """Compute rule-based scoring system"""
    df = df.copy()
    
    # Simplified rule-based scoring
    base_score = 50  # Base score
    
    # Height bonus
    if position.lower() == 'qb':
        height_bonus = np.maximum((df['height_inches'].fillna(72) - 72) * 2, 0)
    else:
        height_bonus = np.maximum((df['height_inches'].fillna(70) - 68), 0)
    
    # Speed bonus (lower 40 time is better)
    speed_bonus = np.maximum((5.0 - df['forty_yard_dash'].fillna(4.8)) * 10, 0)
    
    # Performance bonus
    perf_bonus = (df['ypg'] / 100) * 5
    
    # State bonus
    state_bonus = df['state_talent_score'] * 2
    
    df['rule_score'] = base_score + height_bonus + speed_bonus + perf_bonus + state_bonus
    df['rule_score'] = np.clip(df['rule_score'], 0, 100)
    
    return df

def remove_duplicate_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Remove duplicate columns (both name and value duplicates)"""
    # Remove name duplicates
    df = df.loc[:, ~df.columns.duplicated(keep='first')]
    
    # Remove value duplicates
    df_T = df.T
    value_duplicates = df_T.duplicated(keep='first')
    if value_duplicates.any():
        duplicate_cols = df_T[value_duplicates].index.tolist()
        logger.warning(f"Removing value-duplicate columns: {duplicate_cols}")
        df = df.drop(columns=duplicate_cols)
    
    return df

def preprocess_data(df: pd.DataFrame, position: str, training_stats: Optional[Dict] = None) -> pd.DataFrame:
    """
    Main preprocessing function that applies full production pipeline
    
    Args:
        df: Raw athlete data
        position: Player position (qb, rb, wr)
        training_stats: Training statistics for percentile computation (inference only)
        
    Returns:
        Preprocessed DataFrame with 76+ engineered features
    """
    logger.info(f"Starting full preprocessing pipeline for {position}")
    
    # Step 1: Normalize column names
    df = normalize_column_names(df)
    
    # Step 2: Add essential columns if missing
    essential_defaults = {
        'height_inches': 72,
        'weight_lbs': 200,
        'state': 'ZZ',
        'games': 12
    }
    
    for col, default_val in essential_defaults.items():
        if col not in df.columns:
            df[col] = default_val
    
    # Step 3: Map division targets
    if 'division' in df.columns:
        df = map_division_targets(df)
    
    # Step 4: Intelligent combine imputation
    df = intelligent_combine_imputation(df, position)
    
    # Step 5: Create engineered features
    df = create_engineered_features(df, position)
    
    # Step 6: Compute percentile features
    df = compute_percentile_features(df, training_stats)
    
    # Step 7: Rule-based scoring
    df = compute_rule_based_scores(df, position)
    
    # Step 8: Remove duplicates
    df = remove_duplicate_columns(df)
    
    # Step 9: Final cleanup - exclude object columns from features
    object_cols = df.select_dtypes(include=['object']).columns.tolist()
    feature_cols = [col for col in df.columns if col not in object_cols and col != 'target']
    
    logger.info(f"Preprocessing complete. Features: {len(feature_cols)}, Object columns excluded: {len(object_cols)}")
    
    return df

def get_feature_columns(df: pd.DataFrame) -> List[str]:
    """Get list of feature columns (excluding targets and object columns)"""
    object_cols = df.select_dtypes(include=['object']).columns.tolist()
    exclude_cols = object_cols + ['target', 'division']
    feature_cols = [col for col in df.columns if col not in exclude_cols]
    return feature_cols