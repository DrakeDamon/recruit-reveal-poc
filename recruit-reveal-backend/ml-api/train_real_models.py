#!/usr/bin/env python3
"""
Train real production models with the actual data
"""

import sys
import pandas as pd
from pathlib import Path
import subprocess

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

def prepare_and_train(position, data_dir="../data", models_dir="models"):
    """Prepare data and train model for a position"""
    
    data_dir = Path(data_dir)
    models_dir = Path(models_dir)
    
    # Load original data
    csv_file = data_dir / f"{position}.csv"
    df = pd.read_csv(csv_file)
    
    print(f"📊 Loaded {len(df)} {position.upper()} samples")
    
    # Add required columns
    df['position'] = position.upper()
    df = df.rename(columns={'Division': 'division'})  # Normalize column name
    
    # Map division names to numeric targets (as expected by the pipeline)
    division_map = {
        'Power 5': 3,    # Power5 = 3
        'FCS': 2,        # FCS = 2
        'D2': 1,         # D2 = 1
        'D3': 0,         # D3/NAIA = 0
        'NAIA': 0
    }
    
    df['division_numeric'] = df['division'].map(division_map)
    print(f"   📋 Division mapping: {dict(df['division'].value_counts())}")
    print(f"   🔢 Numeric targets: {dict(df['division_numeric'].value_counts())}")
    
    # Save prepared data with absolute path
    temp_csv = (Path(__file__).parent.parent / "data" / f"{position}_prepared.csv").absolute()
    df.to_csv(temp_csv, index=False)
    print(f"💾 Saved prepared data to {temp_csv}")
    
    # Train using the official script with absolute paths
    models_dir_abs = (Path(__file__).parent / models_dir).absolute()
    cmd = [
        sys.executable, "-m", "scripts.train_and_export",
        "--csv", str(temp_csv),
        "--position", position,
        "--version", "1.2.2", 
        "--models-dir", str(models_dir_abs)
    ]
    
    print(f"🚀 Training {position.upper()} model...")
    result = subprocess.run(cmd, cwd=Path(__file__).parent.parent, capture_output=True, text=True)
    
    if result.returncode == 0:
        print(f"✅ {position.upper()} model trained successfully!")
        print("Training output:")
        for line in result.stdout.split('\n')[-10:]:  # Show last 10 lines
            if line.strip():
                print(f"   {line}")
    else:
        print(f"❌ {position.upper()} model training failed!")
        print("Error output:")
        print(result.stderr)
    
    # Clean up temp file
    if temp_csv.exists():
        temp_csv.unlink()
    
    return result.returncode == 0

if __name__ == "__main__":
    print("🏭 Training real production models...")
    print("=" * 50)
    
    positions = ['qb', 'rb', 'wr']
    successes = 0
    
    for position in positions:
        if prepare_and_train(position):
            successes += 1
        print()
    
    print("=" * 50)
    print(f"🎉 Successfully trained {successes}/{len(positions)} models!")
    
    if successes == len(positions):
        print("✅ All real production models ready for deployment!")