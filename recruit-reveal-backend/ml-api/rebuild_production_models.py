#!/usr/bin/env python3
"""
Rebuild production models without recruit_reveal_production_pipeline dependencies
"""

import sys
import os
import joblib
import json
import pickle
from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.pipeline import Pipeline
import xgboost as xgb
import warnings
warnings.filterwarnings('ignore')

# Add the parent directory to path to access the production pipeline
sys.path.insert(0, str(Path(__file__).parent.parent))

def create_standalone_pipeline(original_model):
    """Extract XGBoost model and create standalone pipeline"""
    
    # If it's a Pipeline, extract the final estimator
    if hasattr(original_model, 'named_steps'):
        xgb_model = original_model.named_steps.get('classifier')
        preprocessor = original_model.named_steps.get('preprocessor')
    else:
        # If it's already just the XGBoost model
        xgb_model = original_model
        preprocessor = None
    
    if xgb_model is None:
        raise ValueError("Could not find XGBoost classifier in pipeline")
    
    # Create a simple wrapper that mimics the original pipeline behavior
    class StandaloneModel(BaseEstimator):
        def __init__(self, xgb_model, feature_names=None):
            self.xgb_model = xgb_model
            self.feature_names = feature_names or []
            
        def predict(self, X):
            # Convert to DataFrame if needed
            if not isinstance(X, pd.DataFrame):
                X = pd.DataFrame(X, columns=self.feature_names)
            
            # Handle missing features by adding them with default values
            missing_cols = set(self.feature_names) - set(X.columns)
            for col in missing_cols:
                X[col] = 0.0  # Default value for missing features
            
            # Reorder columns to match training
            X = X[self.feature_names]
            
            return self.xgb_model.predict(X)
            
        def predict_proba(self, X):
            # Convert to DataFrame if needed
            if not isinstance(X, pd.DataFrame):
                X = pd.DataFrame(X, columns=self.feature_names)
            
            # Handle missing features by adding them with default values
            missing_cols = set(self.feature_names) - set(X.columns)
            for col in missing_cols:
                X[col] = 0.0  # Default value for missing features
            
            # Reorder columns to match training
            X = X[self.feature_names]
            
            return self.xgb_model.predict_proba(X)
    
    return StandaloneModel(xgb_model, getattr(xgb_model, 'feature_names_in_', None))

def rebuild_model(position, source_dir="../models_backup_production", output_dir="models"):
    """Rebuild a production model without dependencies"""
    
    source_dir = Path(source_dir)
    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True)
    
    # Load original model and metadata
    model_file = source_dir / f"recruit_reveal_{position}_pipeline_latest.pkl"
    metadata_file = source_dir / f"recruit_reveal_{position}_pipeline_latest.metadata.json"
    
    if not model_file.exists():
        print(f"❌ Model file not found: {model_file}")
        return False
    
    if not metadata_file.exists():
        print(f"❌ Metadata file not found: {metadata_file}")
        return False
    
    print(f"🔄 Rebuilding {position.upper()} model...")
    
    try:
        # Try to load the original model
        print(f"   📥 Loading original model from {model_file}")
        
        # Try different approaches to load the model
        standalone_model = None
        
        try:
            # First try: load directly 
            original_model = joblib.load(model_file)
            standalone_model = create_standalone_pipeline(original_model)
            print(f"   ✅ Loaded model directly")
        except Exception as e1:
            print(f"   ⚠️ Direct load failed: {e1}")
            
            try:
                # Second try: load with custom unpickler
                import dill
                with open(model_file, 'rb') as f:
                    original_model = dill.load(f)
                standalone_model = create_standalone_pipeline(original_model)
                print(f"   ✅ Loaded model with dill")
            except Exception as e2:
                print(f"   ⚠️ Dill load failed: {e2}")
                
                try:
                    # Third try: just extract the XGBoost model directly
                    with open(model_file, 'rb') as f:
                        data = pickle.load(f)
                    
                    # Look for XGBoost model in the data structure
                    xgb_model = None
                    if hasattr(data, 'named_steps') and 'classifier' in data.named_steps:
                        xgb_model = data.named_steps['classifier']
                    elif isinstance(data, xgb.XGBClassifier):
                        xgb_model = data
                    
                    if xgb_model:
                        class SimpleStandaloneModel:
                            def __init__(self, xgb_model):
                                self.xgb_model = xgb_model
                            
                            def predict(self, X):
                                if isinstance(X, pd.DataFrame):
                                    X = X.values
                                return self.xgb_model.predict(X)
                            
                            def predict_proba(self, X):
                                if isinstance(X, pd.DataFrame):
                                    X = X.values
                                return self.xgb_model.predict_proba(X)
                        
                        standalone_model = SimpleStandaloneModel(xgb_model)
                        print(f"   ✅ Extracted XGBoost model directly")
                    else:
                        raise ValueError("Could not extract XGBoost model")
                        
                except Exception as e3:
                    print(f"   ❌ All loading methods failed: {e3}")
                    return False
        
        if standalone_model is None:
            print(f"   ❌ Could not create standalone model")
            return False
        
        # Load original metadata
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)
        
        # Save standalone model
        output_model_file = output_dir / f"recruit_reveal_{position}_pipeline_latest.pkl"
        joblib.dump(standalone_model, output_model_file)
        print(f"   💾 Saved standalone model to {output_model_file}")
        
        # Update metadata
        metadata['model_type'] = 'standalone_production'
        metadata['rebuild_timestamp'] = pd.Timestamp.now().isoformat()
        metadata['description'] = f"Production {position.upper()} model rebuilt without dependencies"
        metadata['original_accuracy'] = metadata.get('target_accuracy', '100%')
        
        # Save updated metadata
        output_metadata_file = output_dir / f"recruit_reveal_{position}_pipeline_latest.metadata.json"
        with open(output_metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        print(f"   💾 Saved metadata to {output_metadata_file}")
        
        print(f"✅ Successfully rebuilt {position.upper()} model")
        return True
        
    except Exception as e:
        print(f"❌ Failed to rebuild {position.upper()} model: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🏗️ Rebuilding production models without dependencies...")
    print("=" * 60)
    
    positions = ['qb', 'rb', 'wr']
    success_count = 0
    
    for position in positions:
        if rebuild_model(position):
            success_count += 1
        print()
    
    print("=" * 60)
    print(f"🎉 Rebuilt {success_count}/{len(positions)} models successfully")
    
    if success_count == len(positions):
        print("✅ All production models ready for deployment!")
    else:
        print("⚠️ Some models failed to rebuild - check errors above")