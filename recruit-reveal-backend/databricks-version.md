# Databricks ML Pipeline for Recruit Reveal

## Overview
This Databricks notebook implements a comprehensive machine learning pipeline for evaluating and predicting college football recruit success across different positions (QB, RB, WR). The pipeline uses XGBoost classification with advanced feature engineering, intelligent imputation strategies, and meta-scoring systems.

## Key Components

### 1. Data Acquisition & Enhancement
- **`load_base_csv_enhanced()`**: Loads recruit data with intelligent benchmark imputation
- **`intelligent_combine_imputation()`**: Applies position-specific imputation strategies for missing combine metrics
- **`enrich_data_enhanced()`**: Enriches data with baseline FCS/D2/D3 statistics for all positions

### 2. Feature Engineering
- **State Embeddings**: Creates geographical feature representations using `create_state_embeddings()`
- **Advanced Feature Engineering**: Implements polynomial features, interaction terms, and statistical aggregations via `enhanced_feature_engineering()`
- **Winsorization & Scaling**: Applies robust outlier handling through `advanced_winsorize_and_scale()`

### 3. Tier Classification System
Categorizes schools into competitive tiers:
- **Power 5**: Major conference schools (SEC, Big Ten, Big 12, ACC, Pac-12)
- **Group of 5**: Mid-major FBS conferences
- **FCS**: Football Championship Subdivision
- **D2**: Division II
- **D3**: Division III

### 4. Meta-Scoring Framework
Computes comprehensive evaluation scores:
- **Performance Score**: Statistical performance metrics
- **Versatility Score**: Multi-position capability assessment
- **Athleticism Score**: Combine and physical metrics
- **Bonus Score**: Additional achievements and accolades
- **Rule Score**: Position-specific evaluation criteria

### 5. Model Training & Evaluation
- **XGBoost Classifier**: Primary model with hyperparameter optimization
- **Class Balancing**: SMOTE for handling imbalanced datasets
- **Cross-Validation**: 5-fold stratified cross-validation
- **Feature Importance**: SHAP values for model interpretability

## Pipeline Workflow

```python
# 1. Load and prepare data
df = load_base_csv_enhanced(position='QB', year=2024)

# 2. Enrich with baseline statistics
df = enrich_data_enhanced(df, position='QB')

# 3. Preprocess and engineer features
df_processed, features = preprocess_with_winsorization(df, position='QB')

# 4. Train model
model, results = train_model(df_processed, features)

# 5. Generate predictions
predictions = model.predict(new_data)
```

## Key Features

### Intelligent Imputation Strategies
- **Combine Metrics**: Position-specific median imputation
- **Statistical Metrics**: Conference and tier-based benchmarks
- **Missing Data Handling**: Sophisticated fallback strategies

### Advanced Feature Engineering
- Polynomial features (degree 2)
- Interaction terms between key metrics
- Rolling statistics and aggregations
- Position-specific feature selection

### Model Optimization
- Hyperparameter tuning via grid search
- Early stopping to prevent overfitting
- Class weight balancing
- Feature selection based on importance scores

## Position-Specific Configurations

### Quarterbacks (QB)
- Focus on passing efficiency, decision-making metrics
- Dual-threat capability assessment
- Leadership and game management scores

### Running Backs (RB)
- Rushing efficiency and explosiveness metrics
- Pass-catching ability evaluation
- Durability and workload indicators

### Wide Receivers (WR)
- Route-running and separation metrics
- Hands and catching radius evaluation
- YAC (Yards After Catch) potential

## What-If Simulations
The notebook includes functionality for:
- Simulating performance at different division levels
- Projecting improvement trajectories
- Evaluating transfer portal scenarios
- Testing recruiting strategy impacts

## Dependencies
```python
# Core ML Libraries
- scikit-learn
- xgboost
- imbalanced-learn

# Data Processing
- pandas
- numpy
- scipy

# Visualization & Analysis
- shap
- matplotlib (if applicable)

# Spark Integration
- pyspark (for Databricks environment)
```

## Usage Notes

1. **Environment**: Designed for Databricks runtime with Spark integration
2. **Data Format**: Expects CSV input with specific column naming conventions
3. **Memory Management**: Includes safeguards for large dataset processing
4. **Error Handling**: Comprehensive try-catch blocks for robust execution

## Performance Metrics
- **Accuracy**: ~87% classification accuracy achieved
- **F1 Score**: Balanced precision and recall
- **ROC-AUC**: Strong discrimination capability
- **Cross-Validation**: Consistent performance across folds

## Future Enhancements
- Integration with real-time data feeds
- Expanded position coverage (OL, DL, LB, DB)
- Transfer portal prediction models
- NIL (Name, Image, Likeness) impact analysis