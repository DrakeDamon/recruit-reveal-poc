#!/usr/bin/env python3
"""
Upload models to Azure Blob Storage for container deployment
"""
import os
import sys
from pathlib import Path
import logging

# Add current directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

# Import azure blob client
from recruit_reveal.azure_blob_client import AzureBlobClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def upload_models():
    """Upload v1.2.1 models to Azure Blob Storage"""
    
    # Check for SAS_URL
    sas_url = os.getenv("SAS_URL")
    if not sas_url:
        logger.error("❌ SAS_URL environment variable not set")
        return False
    
    # Initialize blob client
    blob_client = AzureBlobClient(sas_url)
    if not blob_client.use_blob:
        logger.error("❌ Azure Blob client not available")
        return False
    
    # Model files to upload from ml-api/models/
    models_dir = Path("ml-api/models")
    if not models_dir.exists():
        logger.error(f"❌ Models directory not found: {models_dir}")
        return False
    
    # Model files to upload
    model_files = [
        "recruit_reveal_qb_pipeline_v1.2.1.pkl",
        "recruit_reveal_qb_pipeline_v1.2.1.metadata.json",
        "recruit_reveal_rb_pipeline_v1.2.1.pkl", 
        "recruit_reveal_rb_pipeline_v1.2.1.metadata.json",
        "recruit_reveal_wr_pipeline_v1.2.1.pkl",
        "recruit_reveal_wr_pipeline_v1.2.1.metadata.json",
        "recruit_reveal_qb_pipeline_latest.pkl",
        "recruit_reveal_qb_pipeline_latest.metadata.json",
        "recruit_reveal_rb_pipeline_latest.pkl",
        "recruit_reveal_rb_pipeline_latest.metadata.json", 
        "recruit_reveal_wr_pipeline_latest.pkl",
        "recruit_reveal_wr_pipeline_latest.metadata.json"
    ]
    
    logger.info(f"📤 Starting upload of {len(model_files)} model files to Azure...")
    
    uploaded = 0
    failed = 0
    
    for filename in model_files:
        local_path = models_dir / filename
        
        if not local_path.exists():
            logger.warning(f"⚠️ Local file not found: {local_path}")
            failed += 1
            continue
            
        if local_path.stat().st_size == 0:
            logger.warning(f"⚠️ Local file is empty: {local_path}")
            failed += 1
            continue
        
        try:
            logger.info(f"📤 Uploading {filename} ({local_path.stat().st_size} bytes)...")
            
            # Upload directly to the data container since that's what we have access to
            if blob_client.container_client:
                blob_client_obj = blob_client.container_client.get_blob_client(filename)
                with open(local_path, "rb") as f:
                    blob_client_obj.upload_blob(f, overwrite=True)
                logger.info(f"✅ Uploaded {filename} to data container")
                uploaded += 1
            else:
                # Fallback to existing upload_model method
                success = blob_client.upload_model(str(local_path), filename)
                if success:
                    logger.info(f"✅ Uploaded {filename}")
                    uploaded += 1
                else:
                    logger.error(f"❌ Failed to upload {filename}")
                    failed += 1
                
        except Exception as e:
            logger.error(f"❌ Error uploading {filename}: {e}")
            failed += 1
    
    logger.info(f"\n📊 Upload Summary:")
    logger.info(f"   ✅ Uploaded: {uploaded}")
    logger.info(f"   ❌ Failed: {failed}")
    logger.info(f"   📁 Total: {len(model_files)}")
    
    if uploaded > 0:
        logger.info(f"\n🎉 Models uploaded successfully!")
        logger.info(f"💡 Next: Deploy to Render - models should now download correctly")
        return True
    else:
        logger.error(f"\n❌ No models uploaded - check Azure permissions and SAS_URL")
        return False

if __name__ == "__main__":
    success = upload_models()
    sys.exit(0 if success else 1)