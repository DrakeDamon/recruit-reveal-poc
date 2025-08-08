# ML Security and Data Protection Guidelines

## 🚨 CRITICAL: Never Commit These Files to Version Control

### Trained Models and Artifacts
- `*.pkl`, `*.joblib` - Serialized ML models (proprietary IP + large files)
- `*.h5`, `*.pt`, `*.pth` - Deep learning model weights
- `models/`, `pipelines/`, `checkpoints/` - Model directories
- `*.metadata.json` - Model versioning metadata (may contain sensitive info)

### Training Data and Datasets
- `*.csv`, `*.parquet`, `*.xlsx` - Raw training data (contains PII)
- `data/`, `datasets/`, `training_data/` - Data directories
- `evals_backup.csv` - Contains athlete evaluation data
- Any files with player names, performance stats, or personal information

### Development Artifacts
- `*.ipynb` - Jupyter notebooks (often contain sensitive experiments)
- `recruit_reveal_production_pipeline.py` - Proprietary ML pipeline code
- `gitingore-eval-logic-test.ipynb` - Development notebook with sensitive logic

### Configuration and Secrets
- `.env`, `.env.*` - Environment variables (may contain API keys, DB credentials)
- `*config.json` - Configuration files (may contain hyperparameters, URLs)

## ✅ Deployment Strategy

### For Production Deployment:
1. **Models**: Store trained models in secure cloud storage (AWS S3, Azure Blob, etc.)
2. **Environment Variables**: Use platform environment variables (Render, Heroku, etc.)
3. **Data**: Never store training data in version control - use secure data pipelines
4. **Secrets**: Use secure secret management (AWS Secrets Manager, etc.)

### For Development:
1. **Local Models**: Store in `ml-api/models/` (gitignored)
2. **Local Data**: Store in `data/` (gitignored)
3. **Local Config**: Use `.env.local` (gitignored)

## 🔒 Model Versioning Security

The enhanced versioning system creates these files (all gitignored):
```
models/
├── recruit_reveal_qb_pipeline_v1.2.0.pkl          # Model file
├── recruit_reveal_qb_pipeline_v1.2.0.metadata.json # Metadata
├── recruit_reveal_qb_pipeline_latest.pkl           # Latest symlink
├── recruit_reveal_qb_pipeline_latest.metadata.json # Latest metadata
└── CHANGELOG_qb.md                                 # Version history
```

## 🚀 Secure Deployment Checklist

### Before Pushing to GitHub:
- [ ] Run `git status` to verify no `.pkl`, `.csv`, or `.ipynb` files are staged
- [ ] Check `.env` files are not included
- [ ] Verify `models/` directory is empty in git
- [ ] Confirm `data/` directory is not tracked

### For Production Deployment:
- [ ] Models uploaded to secure cloud storage
- [ ] Environment variables configured on hosting platform
- [ ] Database credentials stored securely
- [ ] API keys not hardcoded in source

### Regular Security Maintenance:
- [ ] Review gitignore rules monthly
- [ ] Audit repository for accidentally committed sensitive files
- [ ] Rotate API keys and secrets regularly
- [ ] Monitor for data breaches or unauthorized access

## 🛠️ Development Workflow

1. **Training**: Train models locally using `scripts/train_and_export.py`
2. **Storage**: Models saved to local `models/` directory (gitignored)
3. **Testing**: Test API locally with models in `ml-api/models/`
4. **Deployment**: Upload models to secure cloud storage
5. **Production**: API loads models from cloud storage using environment variables

## ⚠️ If Sensitive Data is Accidentally Committed

1. **Immediate Action**: 
   - Remove files from repository immediately
   - Force push to remove from history: `git filter-branch` or BFG Repo-Cleaner
   - Invalidate any exposed credentials/API keys

2. **Security Assessment**:
   - Determine what data was exposed and for how long
   - Check if repository is public or private
   - Review access logs if available

3. **Remediation**:
   - Change all potentially compromised credentials
   - Update security practices and gitignore rules
   - Consider legal/compliance implications for PII exposure

## 📞 Security Contacts

For security incidents or questions about ML data protection:
- Security Team: [security@example.com]
- Data Protection Officer: [dpo@example.com]
- Development Lead: [dev-lead@example.com]

---

**Remember**: Athlete data is sensitive personal information. Treat it with the highest level of security and never commit it to version control.