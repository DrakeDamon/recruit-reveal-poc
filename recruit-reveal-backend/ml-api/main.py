"""
Recruit Reveal ML API Container
FastAPI service for serving trained ML pipeline predictions
"""

import os
import sys
import logging
import traceback
from pathlib import Path
from typing import Dict, Any, Optional, List
import json
import re
from datetime import datetime
from dotenv import load_dotenv

# Add parent directory to Python path to allow model loading
sys.path.insert(0, str(Path(__file__).parent.parent))

# Fix sklearn compatibility issue for older models
try:
    from sklearn.utils import parse_version
except ImportError:
    # For newer sklearn versions, patch the parse_version function
    import sklearn.utils
    try:
        from packaging.version import parse as parse_version
        sklearn.utils.parse_version = parse_version
    except ImportError:
        # Create a simple fallback
        def parse_version(version_string):
            return version_string
        sklearn.utils.parse_version = parse_version

# Load environment variables from .env file
load_dotenv()

import pandas as pd
import numpy as np
import joblib
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Global variables to store loaded models
models = {}
model_metadata = {}
available_versions = {}  # Track all available versions per position

class AthleteData(BaseModel):
    """Pydantic model for athlete input data"""
    # Personal Info
    name: Optional[str] = Field(None, alias="Player_Name")
    position: str = Field(..., description="Player position (QB, RB, WR)")
    height_inches: Optional[float] = Field(None, alias="height")
    weight_lbs: Optional[float] = Field(None, alias="weight") 
    state: Optional[str] = None
    division: Optional[str] = None
    
    # Combine Metrics (may be missing - will be imputed)
    forty_yard_dash: Optional[float] = None
    vertical_jump: Optional[float] = None
    shuttle: Optional[float] = None
    broad_jump: Optional[float] = None
    bench_press: Optional[float] = None
    
    # Senior Year Stats
    senior_ypg: Optional[float] = None
    senior_yds: Optional[float] = None
    senior_tds: Optional[float] = None
    senior_td: Optional[float] = None
    senior_rec: Optional[float] = None
    senior_rec_yds: Optional[float] = None
    senior_avg: Optional[float] = None
    senior_ypc: Optional[float] = None
    senior_comp_pct: Optional[float] = None
    senior_rush_yds: Optional[float] = None
    
    # Junior Year Stats  
    junior_ypg: Optional[float] = None
    junior_yds: Optional[float] = None
    junior_tds: Optional[float] = None
    
    # Other optional fields
    games: Optional[int] = 12
    graduation_year: Optional[int] = None
    gpa: Optional[float] = None
    
    class Config:
        allow_population_by_field_name = True
        extra = "allow"  # Allow extra fields that might come from frontend

class PredictionResponse(BaseModel):
    """Response model for predictions"""
    # Core prediction results
    predicted_division: str
    predicted_tier: str  # Alias for predicted_division
    confidence_score: float
    probability: float  # Alias for confidence_score
    score: float  # Overall score
    
    # Component scores
    performance_score: Optional[float] = None
    combine_score: Optional[float] = None
    upside_score: Optional[float] = None
    underdog_bonus: Optional[float] = None
    rule_score: Optional[float] = None
    
    # Explanations
    notes: str
    goals: List[str]
    switches: str
    calendar_advice: str
    
    # Imputation and data quality flags
    imputation_flags: Dict[str, bool]
    data_completeness_warning: bool
    combine_confidence: Optional[float] = None
    
    # Feature importance and explainability
    feature_importance: Optional[Dict[str, float]] = None
    explainability: Optional[Dict[str, Any]] = None
    
    # What-if and progress simulation results
    what_if_results: Optional[Dict[str, Any]] = None
    progress_results: Optional[Dict[str, Any]] = None
    
    # Metadata
    position: str
    model_version: Optional[str] = None

def validate_version(version: str) -> bool:
    """Validate version format (semantic versioning: X.Y.Z)"""
    pattern = r'^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9\-\.]+))?$'
    return bool(re.match(pattern, version))

def get_available_versions(models_dir: Path, position: str) -> List[Dict[str, Any]]:
    """Get all available versions for a position"""
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

def load_specific_model(models_dir: Path, position: str, version: str = None):
    """Load a specific version of a model"""
    if version is None:
        # Load latest version
        filepath = models_dir / f"recruit_reveal_{position}_pipeline_latest.pkl"
        metadata_path = models_dir / f"recruit_reveal_{position}_pipeline_latest.metadata.json"
        
        if not filepath.exists():
            # Fallback: find latest versioned file
            versions = get_available_versions(models_dir, position)
            if not versions:
                raise FileNotFoundError(f"No models found for position '{position}'")
            
            latest_version = versions[0]['version']
            filepath = models_dir / f"recruit_reveal_{position}_pipeline_v{latest_version}.pkl"
            metadata_path = models_dir / f"recruit_reveal_{position}_pipeline_v{latest_version}.metadata.json"
            logger.info(f"🔍 Loading latest version v{latest_version} for {position.upper()}")
        else:
            logger.info(f"🔍 Loading latest pipeline for {position.upper()}")
    else:
        # Load specific version
        if not validate_version(version):
            raise ValueError(f"Invalid version format: {version}")
            
        filepath = models_dir / f"recruit_reveal_{position}_pipeline_v{version}.pkl"
        metadata_path = models_dir / f"recruit_reveal_{position}_pipeline_v{version}.metadata.json"
        
        if not filepath.exists():
            available = get_available_versions(models_dir, position)
            available_list = [v['version'] for v in available]
            raise FileNotFoundError(
                f"Version {version} not found for {position}. "
                f"Available versions: {available_list}"
            )
        logger.info(f"🔍 Loading specific version v{version} for {position.upper()}")
    
    # Load the pipeline
    try:
        model = joblib.load(filepath)
        metadata = {}
        
        if metadata_path.exists():
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
        
        logger.info(f"✅ Successfully loaded {position.upper()} model from {filepath}")
        return model, metadata
        
    except Exception as e:
        logger.error(f"❌ Failed to load {position.upper()} model: {str(e)}")
        raise RuntimeError(f"Failed to load pipeline from {filepath}: {str(e)}")

def load_models():
    """Load all position-specific models at startup with version support"""
    global models, model_metadata, available_versions
    
    # Support environment variables for model configuration
    model_version = os.getenv("MODEL_VERSION", "latest")
    model_dir_env = os.getenv("MODEL_DIR", None)
    
    # Determine model directory with fallbacks
    if model_dir_env:
        model_dir = Path(model_dir_env)
    else:
        # Try ml-api/models first, then models
        model_dir = Path(__file__).parent / "models"
        if not model_dir.exists():
            model_dir = Path(__file__).parent.parent / "models"
    
    model_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"🔧 Model Configuration:")
    logger.info(f"   MODEL_VERSION: {model_version}")
    logger.info(f"   MODEL_DIR: {model_dir.absolute()}")
    logger.info(f"   Directory exists: {model_dir.exists()}")
    
    # Log directory contents for debugging
    if model_dir.exists():
        try:
            files = list(model_dir.iterdir())
            logger.info(f"📁 Model directory contents ({len(files)} files):")
            for file in sorted(files):
                if file.is_file():
                    logger.info(f"   📄 {file.name} ({file.stat().st_size} bytes)")
                elif file.is_dir():
                    logger.info(f"   📁 {file.name}/ (directory)")
        except Exception as e:
            logger.warning(f"⚠️ Could not list model directory contents: {e}")
    else:
        logger.warning(f"⚠️ Model directory does not exist: {model_dir}")
    
    positions = ['qb', 'rb', 'wr']
    
    for position in positions:
        try:
            # Discover all available versions
            available_versions[position] = get_available_versions(model_dir, position)
            logger.info(f"📚 Found {len(available_versions[position])} version(s) for {position.upper()}")
            
            # Load version specified by environment variable or latest
            if model_version != "latest":
                model, metadata = load_specific_model(model_dir, position, model_version)
                logger.info(f"🎯 Loaded specific version {model_version} for {position.upper()}")
            else:
                model, metadata = load_specific_model(model_dir, position)
                logger.info(f"🎯 Loaded latest version for {position.upper()}")
            models[position] = model
            model_metadata[position] = metadata
            
            logger.info(f"✅ {position.upper()} model loaded successfully")
            
            # Log version info if available
            if 'model_version' in metadata:
                version = metadata['model_version']
                logger.info(f"   📦 Active Version: {version}")
                
        except (FileNotFoundError, RuntimeError) as e:
            logger.warning(f"⚠️ No model found for {position.upper()}: {str(e)}")
        except Exception as e:
            logger.error(f"❌ Failed to load {position.upper()} model: {str(e)}")
    
    if not models:
        logger.warning("⚠️ No models loaded! Please ensure model files are in the models/ directory")
        logger.info("Expected file structure:")
        logger.info("  models/")
        logger.info("    recruit_reveal_qb_pipeline_latest.pkl")
        logger.info("    recruit_reveal_qb_pipeline_latest.metadata.json")
        logger.info("    recruit_reveal_rb_pipeline_latest.pkl")
        logger.info("    recruit_reveal_rb_pipeline_latest.metadata.json")
        logger.info("    recruit_reveal_wr_pipeline_latest.pkl")
        logger.info("    recruit_reveal_wr_pipeline_latest.metadata.json")
        logger.info("")
        logger.info("Or versioned files:")
        logger.info("    recruit_reveal_qb_pipeline_v1.0.0.pkl")
        logger.info("    recruit_reveal_qb_pipeline_v1.0.0.metadata.json")
    else:
        logger.info(f"🚀 Loaded {len(models)} models: {list(models.keys())}")
        
        # Log version summary
        for position, metadata in model_metadata.items():
            if 'model_version' in metadata:
                train_date = metadata.get('train_date', 'unknown')
                if train_date != 'unknown' and 'T' in train_date:
                    train_date = train_date.split('T')[0]  # Just the date part
                logger.info(f"   📊 {position.upper()}: v{metadata['model_version']} (trained: {train_date})")
                
        # Log total available versions
        total_versions = sum(len(versions) for versions in available_versions.values())
        logger.info(f"📊 Total available versions across all positions: {total_versions}")

def generate_explanations(position: str, prediction: str, confidence: float, athlete_data: Dict[str, Any]) -> Dict[str, Any]:
    """Generate position-specific explanations and advice"""
    
    # Position-specific explanation templates
    explanations = {
        'qb': {
            'Power 5': {
                'notes': 'Elite arm strength and accuracy with excellent pocket presence and decision-making',
                'goals': ['Maintain completion percentage above 65%', 'Continue developing leadership skills', 'Work on pre-snap reads'],
                'switches': 'Perfect fit at QB position for Power 5 level',
                'calendar_advice': 'Schedule official visits during December and January. Contact coaches during designated periods.'
            },
            'FCS': {
                'notes': 'Solid fundamentals with good arm strength. Room for improvement in pocket presence and decision-making under pressure',
                'goals': ['Improve 40-yard dash time', 'Increase completion percentage to 65%+', 'Develop better pre-snap recognition'],
                'switches': 'Consider developing as a dual-threat QB or explore WR position if mobility is strong',
                'calendar_advice': 'Target spring visits and summer camps. Focus on FCS showcases and regional combines.'
            },
            'D2': {
                'notes': 'Good foundation but needs development in multiple areas. Shows potential with proper coaching',
                'goals': ['Work on fundamentals daily', 'Improve physical conditioning', 'Study film extensively'],
                'switches': 'Consider WR or safety positions based on athletic ability',
                'calendar_advice': 'Attend D2 showcases and regional camps. Schedule visits during junior days.'
            },
            'D3': {
                'notes': 'Developing player with room for growth. Focus on fundamentals and football IQ',
                'goals': ['Master basic fundamentals', 'Improve overall athleticism', 'Develop leadership qualities'],
                'switches': 'Explore multiple positions based on best athletic fit',
                'calendar_advice': 'Focus on academic fit. Attend local camps and showcases.'
            }
        },
        'rb': {
            'Power 5': {
                'notes': 'Elite combination of speed, power, and vision. Excellent breakaway ability and receiving skills',
                'goals': ['Maintain sub-4.4 forty time', 'Continue developing pass-catching', 'Work on pass protection'],
                'switches': 'Perfect fit at RB position',
                'calendar_advice': 'Schedule official visits during December. Maintain contact with position coaches.'
            },
            'FCS': {
                'notes': 'Good runner with solid vision. Needs to improve breakaway speed and receiving ability',
                'goals': ['Improve 40-yard dash to sub-4.5', 'Develop pass-catching skills', 'Increase yards per carry'],
                'switches': 'Consider fullback role for Power 5 programs or stay at RB for FCS',
                'calendar_advice': 'Target FCS showcases and camps. Schedule spring visits.'
            },
            'D2': {
                'notes': 'Solid fundamentals but lacks elite athleticism. Good between-the-tackles runner',
                'goals': ['Improve overall speed and agility', 'Develop receiving ability', 'Work on pass protection'],
                'switches': 'Consider linebacker or fullback positions',
                'calendar_advice': 'Focus on D2 camps and showcases. Academic fit is important.'
            },
            'D3': {
                'notes': 'Developing runner who can contribute with proper development and coaching',
                'goals': ['Master fundamental techniques', 'Improve conditioning', 'Develop multiple skills'],
                'switches': 'Be flexible with position - consider LB, FB, or special teams',
                'calendar_advice': 'Emphasize academics. Attend local showcases and camps.'
            }
        },
        'wr': {
            'Power 5': {
                'notes': 'Exceptional route running, hands, and athleticism. Elite speed and catching ability',
                'goals': ['Maintain elite speed metrics', 'Continue refining route tree', 'Develop leadership'],
                'switches': 'Perfect fit at WR position',
                'calendar_advice': 'Official visits in December/January. Stay in contact with WR coaches.'
            },
            'FCS': {
                'notes': 'Good receiver with solid hands and route running. Needs to improve separation ability',
                'goals': ['Improve 40-yard dash time', 'Work on release techniques', 'Increase yards after catch'],
                'switches': 'Consider slot receiver role or defensive back position',
                'calendar_advice': 'Target FCS camps and showcases. Schedule spring visits.'
            },
            'D2': {
                'notes': 'Solid fundamentals with room for athletic development. Good hands and work ethic',
                'goals': ['Improve overall speed and agility', 'Develop route precision', 'Work on strength'],
                'switches': 'Consider defensive back or return specialist roles',
                'calendar_advice': 'D2 showcases and academic camps. Focus on fit.'
            },
            'D3': {
                'notes': 'Developing receiver who can contribute with proper coaching and development',
                'goals': ['Master fundamental techniques', 'Improve athleticism', 'Study the game'],
                'switches': 'Be open to multiple positions including defense',
                'calendar_advice': 'Academic fit is priority. Local camps and showcases.'
            }
        }
    }
    
    # Get position and division-specific explanations
    pos_explanations = explanations.get(position.lower(), explanations['qb'])
    div_explanations = pos_explanations.get(prediction, pos_explanations['D3'])
    
    # Adjust explanations based on confidence level
    if confidence < 0.6:
        div_explanations = pos_explanations['D3']  # Lower confidence gets more conservative advice
    
    return div_explanations

def create_what_if_simulations(position: str, prediction: str, athlete_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create What-If simulation results based on position and current stats"""
    
    # Division hierarchy for determining next level
    division_hierarchy = ['D3', 'NAIA', 'D2', 'FCS', 'Power 5', 'Power5']
    current_idx = division_hierarchy.index(prediction) if prediction in division_hierarchy else 0
    next_division = division_hierarchy[min(current_idx + 1, len(division_hierarchy) - 1)]
    
    # Position-specific what-if scenarios
    what_if_templates = {
        'qb': {
            'senior_ypg': {
                'improvement': 25,
                'unit': ' YPG',
                'label': 'Passing YPG',
                'prob_boost': 0.08
            },
            'senior_tds': {
                'improvement': 4,
                'unit': ' TDs',
                'label': 'Passing TDs', 
                'prob_boost': 0.06
            },
            'forty_yard_dash': {
                'improvement': -0.2,
                'unit': 's',
                'label': '40-yard dash',
                'prob_boost': 0.07,
                'format': 'time'
            }
        },
        'rb': {
            'senior_ypg': {
                'improvement': 15,
                'unit': ' YPG',
                'label': 'Rushing YPG',
                'prob_boost': 0.09
            },
            'senior_ypc': {
                'improvement': 0.3,
                'unit': ' YPC',
                'label': 'Yards per carry',
                'prob_boost': 0.05
            },
            'forty_yard_dash': {
                'improvement': -0.1,
                'unit': 's',
                'label': '40-yard dash',
                'prob_boost': 0.10,
                'format': 'time'
            }
        },
        'wr': {
            'senior_rec_ypg': {
                'improvement': 10,
                'unit': ' YPG',
                'label': 'Receiving YPG',
                'prob_boost': 0.08
            },
            'senior_rec': {
                'improvement': 8,
                'unit': ' receptions',
                'label': 'Receptions',
                'prob_boost': 0.06
            },
            'forty_yard_dash': {
                'improvement': -0.1,
                'unit': 's',
                'label': '40-yard dash',
                'prob_boost': 0.12,
                'format': 'time'
            }
        }
    }
    
    # Get position-specific templates
    templates = what_if_templates.get(position.lower(), what_if_templates['qb'])
    
    # Build what-if results
    what_if_results = {}
    base_prob = min(0.85, max(0.45, 0.65 + (current_idx * 0.1)))  # Realistic probability range
    
    for stat, config in templates.items():
        if config.get('format') == 'time':
            # For time-based stats (forty_yard_dash)
            to_next_div = f"to {4.6 + config['improvement']:.1f}{config['unit']}"
        else:
            # For counting stats
            to_next_div = f"+{config['improvement']}{config['unit']}"
        
        what_if_results[stat] = {
            'to_next_div': to_next_div,
            'next_div_name': next_division,
            'next_prob': min(0.95, base_prob + config['prob_boost']),
            'stat_label': config['label']
        }
    
    return what_if_results

def create_progress_simulations(position: str, prediction: str, athlete_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create progress simulation results showing path to next division"""
    
    # Division hierarchy
    division_hierarchy = ['D3', 'NAIA', 'D2', 'FCS', 'Power 5', 'Power5']
    current_idx = division_hierarchy.index(prediction) if prediction in division_hierarchy else 0
    next_division = division_hierarchy[min(current_idx + 1, len(division_hierarchy) - 1)]
    
    # Position-specific progress tracking
    progress_templates = {
        'qb': {
            'senior_ypg': {
                'target': 250,
                'current': athlete_data.get('senior_ypg', 200),
                'improvement': '+25 YPG'
            },
            'senior_tds': {
                'target': 24,
                'current': athlete_data.get('senior_tds', 20),
                'improvement': '+4 TDs'
            },
            'forty_yard_dash': {
                'target': 4.6,
                'current': athlete_data.get('forty_yard_dash', 4.8),
                'improvement': '-0.2s',
                'lower_is_better': True
            }
        },
        'rb': {
            'senior_ypg': {
                'target': 125,
                'current': athlete_data.get('senior_ypg', 100),
                'improvement': '+15 YPG'
            },
            'senior_ypc': {
                'target': 5.2,
                'current': athlete_data.get('senior_ypc', 4.8),
                'improvement': '+0.3 YPC'
            },
            'forty_yard_dash': {
                'target': 4.4,
                'current': athlete_data.get('forty_yard_dash', 4.5),
                'improvement': '-0.1s',
                'lower_is_better': True
            }
        },
        'wr': {
            'senior_rec_ypg': {
                'target': 85,
                'current': athlete_data.get('senior_rec_ypg', athlete_data.get('senior_ypg', 70)),
                'improvement': '+10 YPG'
            },
            'senior_rec': {
                'target': 55,
                'current': athlete_data.get('senior_rec', 47),
                'improvement': '+8 receptions'
            },
            'forty_yard_dash': {
                'target': 4.4,
                'current': athlete_data.get('forty_yard_dash', 4.5),
                'improvement': '-0.1s',
                'lower_is_better': True
            }
        }
    }
    
    # Get position-specific templates
    templates = progress_templates.get(position.lower(), progress_templates['qb'])
    
    # Build progress results
    progress_results = {}
    
    for stat, config in templates.items():
        current = config['current']
        target = config['target']
        
        # Calculate progress percentage
        if config.get('lower_is_better'):
            # For stats where lower is better (like 40-yard dash)
            progress = max(0, min(100, (target - current) / (target - 5.0) * 100)) if target != 5.0 else 0
        else:
            # For stats where higher is better
            progress = max(0, min(100, (current / target) * 100)) if target > 0 else 0
        
        progress_results[stat] = {
            'progress_to_next': f"{progress:.1f}%",
            'improvement_needed': config['improvement'],
            'next_division': next_division,
            'current_value': current
        }
    
    return progress_results

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models on startup"""
    logger.info("🚀 Starting Recruit Reveal ML API server...")
    
    # Print startup banner with environment configuration
    logger.info("=" * 80)
    logger.info("🏈 RECRUIT REVEAL ML API STARTUP CONFIGURATION")
    logger.info("=" * 80)
    logger.info(f"   MODEL_VERSION: {os.getenv('MODEL_VERSION', 'latest')}")
    logger.info(f"   MODEL_DIR: {os.getenv('MODEL_DIR', 'auto-detect')}")
    logger.info(f"   ALLOWED_ORIGINS: {os.getenv('ALLOWED_ORIGINS', '*')}")
    logger.info(f"   PORT: {os.getenv('PORT', '8000')}")
    logger.info(f"   DATABASE_URL: {'configured' if os.getenv('DATABASE_URL') else 'not set'}")
    logger.info("=" * 80)
    
    load_models()
    yield
    logger.info("⏹️ Shutting down ML API server...")

# Initialize FastAPI app
app = FastAPI(
    title="Recruit Reveal ML API",
    description="Machine Learning API for college football athlete evaluation and division prediction",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware with environment variable support
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Recruit Reveal ML API",
        "version": "1.0.0",
        "loaded_models": list(models.keys()),
        "model_count": len(models)
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "models_loaded": len(models),
        "available_positions": list(models.keys()),
        "model_metadata": {pos: meta.get("training_samples", "unknown") for pos, meta in model_metadata.items()}
    }

@app.post("/predict", response_model=PredictionResponse)
async def predict(athlete_data: AthleteData):
    """
    Predict division level for an athlete
    
    Args:
        athlete_data: Athlete statistics and combine metrics
        
    Returns:
        Prediction response with division, confidence, and explanations
    """
    try:
        position = athlete_data.position.lower()
        logger.info(f"🏈 Predicting for {position.upper()} player: {athlete_data.name or 'Unknown'}")
        
        # Check if model exists for this position
        if position not in models:
            raise HTTPException(
                status_code=400, 
                detail=f"No model available for position: {position.upper()}. Available positions: {list(models.keys())}"
            )
        
        # Get the model
        model = models[position]
        
        # Convert Pydantic model to DataFrame
        athlete_dict = athlete_data.dict(by_alias=True, exclude_none=False)
        
        # Handle name field aliasing
        if athlete_data.name:
            athlete_dict['Player_Name'] = athlete_data.name
            
        # Create DataFrame
        df = pd.DataFrame([athlete_dict])
        
        # Use the preprocessor's validate_input method for cleaning
        preprocessor = model.named_steps['preprocessor']
        df_validated = preprocessor.validate_input(df)
        
        logger.info(f"📊 Input data shape after validation: {df_validated.shape}")
        
        # Make predictions
        prediction = model.predict(df_validated)[0]
        probabilities = model.predict_proba(df_validated)[0]
        
        # Get class labels
        classes = model.named_steps['model'].classes_
        confidence = float(max(probabilities))
        
        # Create probability mapping
        prob_dict = dict(zip(classes, probabilities))
        logger.info(f"🎯 Prediction: {prediction} (confidence: {confidence:.3f})")
        
        # Get imputation flags from transformed data
        transformed_data = preprocessor.transform(df_validated)
        imputation_flags = {}
        combine_confidence = 1.0
        
        for col in ['forty_yard_dash_imputed', 'vertical_jump_imputed', 'shuttle_imputed', 'broad_jump_imputed']:
            if col in transformed_data.columns:
                imputed = bool(transformed_data[col].iloc[0])
                imputation_flags[col.replace('_imputed', '')] = imputed
                if imputed:
                    combine_confidence -= 0.2
        
        # Add bench press imputation flag (not typically in our pipeline but expected by frontend)
        imputation_flags['bench_press_imputed'] = False
        
        combine_confidence = max(0.0, combine_confidence)
        data_completeness_warning = any(imputation_flags.values())
        
        # Generate explanations and advice
        explanations = generate_explanations(position, prediction, confidence, athlete_dict)
        
        # Create what-if and progress simulations
        what_if_results = create_what_if_simulations(position, prediction, athlete_dict)
        progress_results = create_progress_simulations(position, prediction, athlete_dict)
        
        # Calculate component scores (from pipeline if available, else estimated)
        rule_score = None
        if 'rule_score' in transformed_data.columns:
            rule_score = float(transformed_data['rule_score'].iloc[0])
        
        # Estimate component scores based on overall confidence
        performance_score = min(1.0, confidence + 0.1)
        combine_score = combine_confidence * 0.8
        upside_score = max(0.05, (confidence - 0.5) * 0.3) if confidence > 0.5 else 0.05
        underdog_bonus = 0.05 if prediction in ['D3', 'NAIA'] else 0.0
        
        # Overall score (0-100 scale)
        overall_score = confidence * 100
        
        # Create feature importance (simplified)
        feature_importance = {
            "combine_metrics": combine_confidence * 0.3,
            "performance_stats": performance_score * 0.4,
            "physical_attributes": 0.2,
            "trajectory": 0.1
        }
        
        # Build response
        response = PredictionResponse(
            predicted_division=prediction,
            predicted_tier=prediction,  # Alias
            confidence_score=confidence,
            probability=confidence,  # Alias
            score=overall_score,
            performance_score=performance_score,
            combine_score=combine_score,
            upside_score=upside_score,
            underdog_bonus=underdog_bonus,
            rule_score=rule_score,
            notes=explanations['notes'],
            goals=explanations['goals'],
            switches=explanations['switches'],
            calendar_advice=explanations['calendar_advice'],
            imputation_flags=imputation_flags,
            data_completeness_warning=data_completeness_warning,
            combine_confidence=combine_confidence,
            feature_importance=feature_importance,
            explainability=prob_dict,
            what_if_results=what_if_results,
            progress_results=progress_results,
            position=position.upper(),
            model_version=model_metadata.get(position, {}).get('model_version', '1.0.0')
        )
        
        logger.info(f"✅ Prediction complete: {prediction} with {confidence:.1%} confidence")
        return response
        
    except Exception as e:
        logger.error(f"❌ Prediction error: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.post("/predict/batch")
async def predict_batch(athletes: List[AthleteData]):
    """
    Batch prediction endpoint for multiple athletes
    
    Args:
        athletes: List of athlete data
        
    Returns:
        List of prediction responses
    """
    try:
        results = []
        for athlete in athletes:
            try:
                result = await predict(athlete)
                results.append(result)
            except Exception as e:
                logger.error(f"Failed to predict for athlete {athlete.name}: {str(e)}")
                # Continue with other predictions
                continue
        
        return {"predictions": results, "total": len(results), "requested": len(athletes)}
        
    except Exception as e:
        logger.error(f"Batch prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")

@app.post("/predict/{version}", response_model=PredictionResponse)
async def predict_with_version(athlete_data: AthleteData, version: str):
    """
    Predict division level for an athlete using a specific model version
    
    Args:
        athlete_data: Athlete statistics and combine metrics
        version: Model version to use (e.g., "1.2.0")
        
    Returns:
        Prediction response with division, confidence, and explanations
    """
    try:
        position = athlete_data.position.lower()
        logger.info(f"🏈 Predicting for {position.upper()} player with version {version}: {athlete_data.name or 'Unknown'}")
        
        # Validate version format
        if not validate_version(version):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid version format: {version}. Use semantic versioning (e.g., '1.2.0')"
            )
        
        # Load specific version
        model_dir = Path(__file__).parent / "models"
        try:
            model, metadata = load_specific_model(model_dir, position, version)
        except FileNotFoundError as e:
            available = get_available_versions(model_dir, position)
            available_list = [v['version'] for v in available]
            raise HTTPException(
                status_code=404,
                detail=f"Version {version} not found for {position.upper()}. Available versions: {available_list}"
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load model version {version}: {str(e)}")
        
        # Convert Pydantic model to DataFrame
        athlete_dict = athlete_data.dict(by_alias=True, exclude_none=False)
        
        # Handle name field aliasing
        if athlete_data.name:
            athlete_dict['Player_Name'] = athlete_data.name
            
        # Create DataFrame
        df = pd.DataFrame([athlete_dict])
        
        # Use the preprocessor's validate_input method for cleaning
        preprocessor = model.named_steps['preprocessor']
        df_validated = preprocessor.validate_input(df)
        
        logger.info(f"📊 Input data shape after validation: {df_validated.shape}")
        
        # Make predictions using specific version
        prediction = model.predict(df_validated)[0]
        probabilities = model.predict_proba(df_validated)[0]
        
        # Get class labels
        classes = model.named_steps['model'].classes_
        confidence = float(max(probabilities))
        
        # Create probability mapping
        prob_dict = dict(zip(classes, probabilities))
        logger.info(f"🎯 Prediction (v{version}): {prediction} (confidence: {confidence:.3f})")
        
        # Get imputation flags from transformed data
        transformed_data = preprocessor.transform(df_validated)
        imputation_flags = {}
        combine_confidence = 1.0
        
        for col in ['forty_yard_dash_imputed', 'vertical_jump_imputed', 'shuttle_imputed', 'broad_jump_imputed']:
            if col in transformed_data.columns:
                imputed = bool(transformed_data[col].iloc[0])
                imputation_flags[col.replace('_imputed', '')] = imputed
                if imputed:
                    combine_confidence -= 0.2
        
        # Add bench press imputation flag
        imputation_flags['bench_press_imputed'] = False
        
        combine_confidence = max(0.0, combine_confidence)
        data_completeness_warning = any(imputation_flags.values())
        
        # Generate explanations and advice
        explanations = generate_explanations(position, prediction, confidence, athlete_dict)
        
        # Create what-if and progress simulations
        what_if_results = create_what_if_simulations(position, prediction, athlete_dict)
        progress_results = create_progress_simulations(position, prediction, athlete_dict)
        
        # Calculate component scores
        rule_score = None
        if 'rule_score' in transformed_data.columns:
            rule_score = float(transformed_data['rule_score'].iloc[0])
        
        # Estimate component scores based on overall confidence
        performance_score = min(1.0, confidence + 0.1)
        combine_score = combine_confidence * 0.8
        upside_score = max(0.05, (confidence - 0.5) * 0.3) if confidence > 0.5 else 0.05
        underdog_bonus = 0.05 if prediction in ['D3', 'NAIA'] else 0.0
        
        # Overall score (0-100 scale)
        overall_score = confidence * 100
        
        # Create feature importance (simplified)
        feature_importance = {
            "combine_metrics": combine_confidence * 0.3,
            "performance_stats": performance_score * 0.4,
            "physical_attributes": 0.2,
            "trajectory": 0.1
        }
        
        # Build response
        response = PredictionResponse(
            predicted_division=prediction,
            predicted_tier=prediction,  # Alias
            confidence_score=confidence,
            probability=confidence,  # Alias
            score=overall_score,
            performance_score=performance_score,
            combine_score=combine_score,
            upside_score=upside_score,
            underdog_bonus=underdog_bonus,
            rule_score=rule_score,
            notes=explanations['notes'],
            goals=explanations['goals'],
            switches=explanations['switches'],
            calendar_advice=explanations['calendar_advice'],
            imputation_flags=imputation_flags,
            data_completeness_warning=data_completeness_warning,
            combine_confidence=combine_confidence,
            feature_importance=feature_importance,
            explainability=prob_dict,
            what_if_results=what_if_results,
            progress_results=progress_results,
            position=position.upper(),
            model_version=version
        )
        
        logger.info(f"✅ Prediction complete (v{version}): {prediction} with {confidence:.1%} confidence")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Prediction error (v{version}): {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.get("/models")
async def get_models():
    """Get information about loaded models with version details"""
    model_info = {}
    for position, model in models.items():
        metadata = model_metadata.get(position, {})
        versions = available_versions.get(position, [])
        
        model_info[position] = {
            "loaded": True,
            "active_version": metadata.get("model_version", "unknown"),
            "training_samples": metadata.get("training_samples", "unknown"),
            "features_count": metadata.get("features_count", "unknown"),
            "target_classes": metadata.get("target_classes", "unknown"),
            "model_type": "XGBoost Pipeline",
            "train_date": metadata.get("train_date", "unknown"),
            "available_versions": [v['version'] for v in versions],
            "total_versions": len(versions)
        }
    
    return {
        "available_models": model_info,
        "total_models": len(models),
        "total_versions": sum(len(versions) for versions in available_versions.values())
    }

@app.get("/models/{position}")
async def get_model_info(position: str):
    """Get detailed information about a specific position's models"""
    position = position.lower()
    
    if position not in ['qb', 'rb', 'wr']:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid position: {position}. Valid positions: qb, rb, wr"
        )
    
    # Get all available versions
    model_dir = Path(__file__).parent / "models"
    versions = get_available_versions(model_dir, position)
    
    # Get currently loaded model info
    current_metadata = model_metadata.get(position, {})
    
    return {
        "position": position.upper(),
        "currently_loaded": position in models,
        "active_version": current_metadata.get("model_version", "unknown") if position in models else None,
        "total_versions": len(versions),
        "available_versions": versions,
        "model_metadata": current_metadata if position in models else None,
        "changelog_path": f"CHANGELOG_{position}.md"
    }

@app.get("/models/{position}/versions")
async def get_position_versions(position: str):
    """Get all available versions for a specific position"""
    position = position.lower()
    
    if position not in ['qb', 'rb', 'wr']:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid position: {position}. Valid positions: qb, rb, wr"
        )
    
    model_dir = Path(__file__).parent / "models"
    versions = get_available_versions(model_dir, position)
    
    return {
        "position": position.upper(),
        "total_versions": len(versions),
        "versions": versions
    }

@app.post("/models/{position}/switch")
async def switch_model_version(position: str, version: str = Query(..., description="Version to switch to")):
    """Switch the active model version for a position"""
    global models, model_metadata
    
    position = position.lower()
    
    if position not in ['qb', 'rb', 'wr']:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid position: {position}. Valid positions: qb, rb, wr"
        )
    
    if not validate_version(version):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid version format: {version}. Use semantic versioning (e.g., '1.2.0')"
        )
    
    try:
        # Load specific version
        model_dir = Path(__file__).parent / "models"
        model, metadata = load_specific_model(model_dir, position, version)
        
        # Update global state
        models[position] = model
        model_metadata[position] = metadata
        
        logger.info(f"🔄 Switched {position.upper()} model to version {version}")
        
        return {
            "status": "success",
            "message": f"Successfully switched {position.upper()} model to version {version}",
            "position": position.upper(),
            "new_version": version,
            "model_metadata": metadata
        }
        
    except FileNotFoundError:
        available = get_available_versions(model_dir, position)
        available_list = [v['version'] for v in available]
        raise HTTPException(
            status_code=404,
            detail=f"Version {version} not found for {position.upper()}. Available versions: {available_list}"
        )
    except Exception as e:
        logger.error(f"❌ Failed to switch {position.upper()} model to version {version}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to switch model version: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    
    # Get port from environment variable or default to 8000
    port = int(os.getenv("PORT", 8000))
    
    logger.info(f"🚀 Starting Recruit Reveal ML API on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)