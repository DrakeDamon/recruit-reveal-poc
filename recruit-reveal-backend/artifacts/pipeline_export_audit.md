# Pipeline Export Audit Report

**Date**: 2024-01-15  
**Auditor**: AI Assistant  
**Scope**: Investigation of missing per-position .pkl model files

## Executive Summary

The investigation reveals **three critical root causes** why per-position model exports (`recruit_reveal_{qb|rb|wr}_pipeline.pkl` + `.metadata.json`) were not created:

1. **Missing models/ directory** - Export destination doesn't exist
2. **No training data CSV** - `csv_path` points to non-existent file
3. **No executed training workflow** - Pipeline exists but never runs automatically

## Detailed Findings

### Root Cause 1: Missing Models Directory

**File**: N/A  
**Issue**: The `models/` directory referenced in save operations does not exist.

**Evidence**:

- `ls -la` shows no `models/` directory in `/recruit-reveal-backend/`
- `save_pipeline()` in lines 1072-1073 of `recruit_reveal_production_pipeline.py` creates the directory only if called

```python
models_dir = Path(models_dir)
models_dir.mkdir(parents=True, exist_ok=True)  # Line 1073
```

**Impact**: Pipeline save operations would fail or create empty directory without running.

### Root Cause 2: Hard-coded Non-existent CSV Path

**File**: `recruit_reveal_production_pipeline.py`  
**Lines**: 1495-1496

**Issue**: The main entrypoint references a non-existent CSV file path:

```python
if __name__ == "__main__":
    position = "qb"  # Change to 'rb' or 'wr' as needed
    csv_path = "path/to/your/training_data.csv"  # Update with actual path
```

**Evidence**:

- The CSV path is a placeholder comment, not a real file
- No actual training data CSV files exist in the repository structure
- `evals_backup.csv` exists but is empty (0 bytes)

**Impact**: Running `python recruit_reveal_production_pipeline.py` results in FileNotFoundError.

### Root Cause 3: No Automated Training Execution

**File**: `gitingore-eval-logic-test.ipynb`  
**Lines**: Various cells

**Issue**: The notebook contains training logic but does **not** call the production pipeline's save_pipeline() method for each position.

**Evidence**:

- Notebook runs comprehensive training and evaluation (cells 10-12)
- Training creates models in memory but they are never persisted
- No calls to `save_pipeline()` with position-specific arguments
- Test simulation functions exist but are disconnected from export workflow

```python
# Notebook creates enhanced_model but never saves it:
enhanced_model.fit(X_train_aug, y_train_aug)  # Line 1701
# Missing: pipeline.save_pipeline('models/', model_version='1.0.0')
```

### Root Cause 4: Insufficient Position-Specific Training

**File**: `recruit_reveal_production_pipeline.py`  
**Lines**: 1493-1555

**Issue**: The current `if __name__ == "__main__"` block only trains ONE position at a time, not all three.

**Evidence**:

```python
position = "qb"  # Change to 'rb' or 'wr' as needed  # Line 1495
```

**Impact**: Even if CSV existed, only QB models would be created, not RB/WR.

## Additional Technical Issues

### Issue A: Notebook-Pipeline Disconnect

The notebook (`gitingore-eval-logic-test.ipynb`) and production pipeline (`recruit_reveal_production_pipeline.py`) operate independently:

- Notebook: Trains models but doesn't export using production methods
- Pipeline: Has export capability but lacks proper data/entrypoint

### Issue B: Missing CLI Interface

No command-line interface exists for:

- Training all positions in batch
- Specifying version numbers
- Providing CSV path as argument

### Issue C: Environment Configuration

ML-API expects models in specific locations but has no mechanism to generate them initially.

## Fix Implementation Plan

### Immediate Actions Required:

1. **Create Training Script** (`scripts/train_and_export.py`)

   - Accept `--csv PATH`, `--position qb|rb|wr|all`, `--version X.Y.Z`
   - Train each position separately
   - Export versioned files + latest aliases

2. **Create Models Directory Structure**

   ```
   models/
   ├── recruit_reveal_qb_pipeline_v1.0.0.pkl
   ├── recruit_reveal_qb_pipeline_v1.0.0.metadata.json
   ├── recruit_reveal_qb_pipeline_latest.pkl
   └── recruit_reveal_qb_pipeline_latest.metadata.json
   ```

3. **Fix Notebook Integration**

   - Add final cell calling training script
   - Remove in-notebook save attempts

4. **Update ML-API Environment Support**
   - Support `MODEL_VERSION` env var
   - Graceful fallback for missing files

## Verification Steps

After implementing fixes:

1. Run: `python -m scripts.train_and_export --csv data/training.csv --position all --version 1.0.0`
2. Verify 6 files created (3 positions × 2 files each) + latest aliases
3. Test ML-API loads models correctly
4. Validate version switching functionality

## Risk Assessment

**High Risk**: Current state blocks deployment completely
**Medium Risk**: Data quality issues if CSV format changes
**Low Risk**: Version management complexity

---

**Status**: Ready for implementation  
**Next Steps**: Begin fix implementation according to plan above
