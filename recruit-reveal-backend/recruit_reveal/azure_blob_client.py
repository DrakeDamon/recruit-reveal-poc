"""
Azure Blob Storage Client with Local Fallback
Handles model and data storage with SAS URL authentication
"""

import os
import logging
from pathlib import Path
from typing import Optional, Dict, Any
import json
import pandas as pd

logger = logging.getLogger(__name__)

class AzureBlobClient:
    """Azure Blob Storage client with local fallback"""

    def __init__(self, sas_url: Optional[str] = None):
        """
        Initialize Azure Blob client

        Args:
            sas_url: Azure Blob SAS URL for authentication
        """
        self.sas_url = sas_url or os.getenv('SAS_URL')
        self.use_blob = bool(self.sas_url)

        if self.use_blob:
            try:
                from azure.storage.blob import BlobServiceClient, ContainerClient
                
                # Check if SAS URL is container-specific or account-level
                if '/data?' in self.sas_url:
                    # Container-specific SAS URL
                    self.container_client = ContainerClient.from_container_url(self.sas_url)
                    self.blob_service = None
                    self.container_name = "data"
                else:
                    # Account-level SAS URL
                    self.blob_service = BlobServiceClient(account_url=self.sas_url)
                    self.container_client = None
                    self.container_name = "recruit-reveal-data"
                
                logger.info("✅ Azure Blob Storage initialized")
            except ImportError:
                logger.warning("azure-storage-blob not installed, falling back to local storage")
                self.use_blob = False
            except Exception as e:
                logger.warning(f"Failed to initialize Azure Blob: {e}, falling back to local")
                self.use_blob = False
        else:
            logger.info("📁 Using local file storage (no SAS_URL provided)")

    def download_csv(self, blob_name: str, local_path: str) -> bool:
        """
        Download CSV from blob storage or use local fallback

        Args:
            blob_name: Name of blob in storage (e.g., 'qb.csv')
            local_path: Local path to save file

        Returns:
            True if successful, False otherwise
        """
        # Map standard names to actual blob names
        blob_name_mapping = {
            'qb.csv': '221 QB FINAL - Sheet1.csv',
            'rb.csv': 'RB list 1 - Sheet1.csv', 
            'wr.csv': 'wr final - Sheet1.csv'
        }
        
        actual_blob_name = blob_name_mapping.get(blob_name, blob_name)
        
        if self.use_blob:
            try:
                if self.container_client:
                    # Container-specific SAS URL
                    blob_client = self.container_client.get_blob_client(actual_blob_name)
                else:
                    # Account-level SAS URL
                    blob_client = self.blob_service.get_blob_client(
                        container=self.container_name,
                        blob=actual_blob_name
                    )

                with open(local_path, "wb") as f:
                    f.write(blob_client.download_blob().readall())

                logger.info(f"✅ Downloaded {actual_blob_name} from Azure Blob to {local_path}")
                return True

            except Exception as e:
                logger.warning(f"Failed to download {actual_blob_name} from blob: {e}")
                return self._use_local_dummy(local_path, blob_name)
        else:
            return self._use_local_dummy(local_path, blob_name)

    def upload_model(self, local_path: str, blob_name: str) -> bool:
        """
        Upload model to blob storage

        Args:
            local_path: Local model file path
            blob_name: Target blob name

        Returns:
            True if successful, False otherwise
        """
        if self.use_blob:
            try:
                if self.container_client:
                    # Container-specific SAS URL - would need models container access
                    logger.warning("Container-specific SAS URL doesn't support model uploads")
                    return False
                else:
                    # Account-level SAS URL
                    container_name = "recruit-reveal-models"
                    blob_client = self.blob_service.get_blob_client(
                        container=container_name,
                        blob=blob_name
                    )

                    with open(local_path, "rb") as f:
                        blob_client.upload_blob(f, overwrite=True)

                    logger.info(f"✅ Uploaded {blob_name} to Azure Blob")
                    return True

            except Exception as e:
                logger.warning(f"Failed to upload to blob: {e}")
                return False
        else:
            logger.info(f"📁 Model saved locally: {local_path}")
            return True

    def _use_local_dummy(self, local_path: str, blob_name: str) -> bool:
        """
        Create dummy data for local testing

        Args:
            local_path: Path to save dummy data
            blob_name: Name indicating position (qb.csv, rb.csv, wr.csv)

        Returns:
            True if successful
        """
        position = blob_name.split('.')[0].lower()

        # Create comprehensive dummy data based on position
        if position == 'qb':
            dummy_data = {
                'Player_Name': [
                    'Elite QB 1', 'Elite QB 2', 'Elite QB 3', 'Elite QB 4', 'Elite QB 5',
                    'FCS QB 1', 'FCS QB 2', 'FCS QB 3', 'FCS QB 4', 'FCS QB 5',
                    'D2 QB 1', 'D2 QB 2', 'D2 QB 3', 'D2 QB 4', 'D2 QB 5',
                    'D3 QB 1', 'D3 QB 2', 'D3 QB 3', 'D3 QB 4', 'D3 QB 5'
                ],
                'Division': [
                    'Power5', 'Power5', 'Power5', 'Power5', 'Power5',
                    'FCS', 'FCS', 'FCS', 'FCS', 'FCS',
                    'D2', 'D2', 'D2', 'D2', 'D2',
                    'D3', 'D3', 'D3', 'D3', 'D3'
                ],
                'Height': [75, 76, 74, 75, 77, 73, 74, 75, 72, 73, 72, 73, 74, 71, 72, 71, 72, 73, 70, 71],
                'Weight': [220, 225, 215, 220, 230, 210, 215, 220, 205, 210, 200, 205, 210, 195, 200, 190, 195, 200, 185, 190],
                'Comp_Pct': [68.5, 67.2, 69.1, 66.8, 70.2, 64.5, 63.8, 65.2, 62.1, 63.5, 60.8, 61.5, 62.8, 59.2, 60.1, 57.5, 58.2, 59.1, 56.8, 57.5],
                'Pass_Yds': [3500, 3800, 3200, 3600, 4000, 2800, 3000, 3200, 2500, 2700, 2200, 2400, 2600, 2000, 2200, 1800, 2000, 2200, 1600, 1800],
                'YPG': [280, 300, 260, 290, 320, 230, 250, 270, 210, 230, 190, 210, 230, 170, 190, 150, 170, 190, 130, 150],
                'TDs': [28, 32, 25, 30, 35, 22, 25, 28, 18, 22, 15, 18, 22, 12, 15, 10, 12, 15, 8, 10],
                'INTs': [8, 6, 10, 7, 5, 12, 10, 8, 15, 12, 18, 15, 12, 20, 18, 22, 20, 18, 25, 22],
                'Att': [450, 480, 420, 460, 500, 380, 400, 420, 350, 370, 320, 340, 360, 300, 320, 280, 300, 320, 260, 280],
                '40 Time': [4.75, 4.70, 4.80, 4.75, 4.65, 4.85, 4.80, 4.75, 4.90, 4.85, 4.95, 4.90, 4.85, 5.00, 4.95, 5.05, 5.00, 4.95, 5.10, 5.05],
                'Vertical': [33, 35, 32, 34, 36, 30, 31, 32, 28, 29, 26, 27, 28, 24, 25, 22, 23, 24, 20, 21],
                'Broad Jump': [110, 115, 108, 112, 118, 105, 107, 109, 102, 104, 98, 100, 102, 95, 97, 92, 94, 96, 90, 92],
                'Shuttle': [4.25, 4.20, 4.30, 4.25, 4.15, 4.35, 4.30, 4.25, 4.40, 4.35, 4.45, 4.40, 4.35, 4.50, 4.45, 4.55, 4.50, 4.45, 4.60, 4.55],
                'Bench': [20, 22, 18, 20, 24, 16, 17, 18, 14, 15, 12, 13, 14, 10, 11, 8, 9, 10, 6, 7]
            }
        elif position == 'rb':
            dummy_data = {
                'Player_Name': [
                    'Elite RB 1', 'Elite RB 2', 'Elite RB 3', 'Elite RB 4', 'Elite RB 5',
                    'FCS RB 1', 'FCS RB 2', 'FCS RB 3', 'FCS RB 4', 'FCS RB 5',
                    'D2 RB 1', 'D2 RB 2', 'D2 RB 3', 'D2 RB 4', 'D2 RB 5',
                    'D3 RB 1', 'D3 RB 2', 'D3 RB 3', 'D3 RB 4', 'D3 RB 5'
                ],
                'Division': [
                    'Power5', 'Power5', 'Power5', 'Power5', 'Power5',
                    'FCS', 'FCS', 'FCS', 'FCS', 'FCS',
                    'D2', 'D2', 'D2', 'D2', 'D2',
                    'D3', 'D3', 'D3', 'D3', 'D3'
                ],
                'Height': [70, 71, 69, 70, 72, 69, 70, 71, 68, 69, 68, 69, 70, 67, 68, 67, 68, 69, 66, 67],
                'Weight': [210, 215, 205, 210, 220, 200, 205, 210, 195, 200, 190, 195, 200, 185, 190, 180, 185, 190, 175, 180],
                'Rush_Yds': [1500, 1800, 1400, 1600, 2000, 1200, 1400, 1600, 1000, 1200, 800, 1000, 1200, 600, 800, 500, 600, 800, 400, 500],
                'YPC': [6.2, 6.8, 5.8, 6.5, 7.2, 5.5, 6.0, 6.5, 5.0, 5.5, 4.5, 5.0, 5.5, 4.0, 4.5, 3.5, 4.0, 4.5, 3.0, 3.5],
                'Rush_TDs': [15, 18, 12, 16, 20, 10, 12, 15, 8, 10, 6, 8, 10, 4, 6, 3, 4, 6, 2, 3],
                'Rec': [25, 30, 20, 25, 35, 18, 22, 25, 15, 18, 12, 15, 18, 10, 12, 8, 10, 12, 6, 8],
                'Rec_Yds': [250, 300, 200, 250, 350, 180, 220, 250, 150, 180, 120, 150, 180, 100, 120, 80, 100, 120, 60, 80],
                'Games': [12, 13, 11, 12, 14, 11, 12, 13, 10, 11, 9, 10, 11, 8, 9, 7, 8, 9, 6, 7],
                '40 Time': [4.45, 4.40, 4.50, 4.45, 4.35, 4.55, 4.50, 4.45, 4.60, 4.55, 4.65, 4.60, 4.55, 4.70, 4.65, 4.75, 4.70, 4.65, 4.80, 4.75],
                'Vertical': [36, 38, 34, 36, 40, 32, 34, 36, 30, 32, 28, 30, 32, 26, 28, 24, 26, 28, 22, 24],
                'Broad Jump': [118, 122, 115, 118, 125, 112, 115, 118, 108, 112, 105, 108, 112, 102, 105, 98, 102, 105, 95, 98],
                'Shuttle': [4.10, 4.05, 4.15, 4.10, 4.00, 4.20, 4.15, 4.10, 4.25, 4.20, 4.30, 4.25, 4.20, 4.35, 4.30, 4.40, 4.35, 4.30, 4.45, 4.40],
                'Bench': [22, 25, 20, 22, 28, 18, 20, 22, 16, 18, 14, 16, 18, 12, 14, 10, 12, 14, 8, 10]
            }
        elif position == 'wr':
            dummy_data = {
                'Player_Name': [
                    'Elite WR 1', 'Elite WR 2', 'Elite WR 3', 'Elite WR 4', 'Elite WR 5',
                    'FCS WR 1', 'FCS WR 2', 'FCS WR 3', 'FCS WR 4', 'FCS WR 5',
                    'D2 WR 1', 'D2 WR 2', 'D2 WR 3', 'D2 WR 4', 'D2 WR 5',
                    'NAIA WR 1', 'NAIA WR 2', 'NAIA WR 3', 'NAIA WR 4', 'NAIA WR 5'
                ],
                'Division': [
                    'Power5', 'Power5', 'Power5', 'Power5', 'Power5',
                    'FCS', 'FCS', 'FCS', 'FCS', 'FCS',
                    'D2', 'D2', 'D2', 'D2', 'D2',
                    'NAIA', 'NAIA', 'NAIA', 'NAIA', 'NAIA'
                ],
                'Height': [73, 74, 72, 73, 75, 72, 73, 74, 71, 72, 71, 72, 73, 70, 71, 70, 71, 72, 69, 70],
                'Weight': [195, 200, 190, 195, 205, 185, 190, 195, 180, 185, 175, 180, 185, 170, 175, 165, 170, 175, 160, 165],
                'Rec': [65, 75, 60, 65, 80, 55, 60, 65, 45, 50, 35, 40, 45, 25, 30, 20, 25, 30, 15, 20],
                'Rec_Yds': [950, 1100, 900, 950, 1200, 800, 900, 950, 650, 750, 500, 600, 650, 350, 450, 250, 350, 450, 200, 250],
                'Avg': [14.6, 14.7, 15.0, 14.6, 15.0, 14.5, 15.0, 14.6, 14.4, 15.0, 14.3, 15.0, 14.4, 14.0, 15.0, 12.5, 14.0, 15.0, 13.3, 12.5],
                'TDs': [10, 12, 8, 10, 15, 8, 10, 12, 6, 8, 4, 6, 8, 2, 4, 1, 2, 4, 1, 1],
                '40 Time': [4.40, 4.35, 4.45, 4.40, 4.30, 4.50, 4.45, 4.40, 4.55, 4.50, 4.60, 4.55, 4.50, 4.65, 4.60, 4.70, 4.65, 4.60, 4.75, 4.70],
                'Vertical': [38, 40, 36, 38, 42, 34, 36, 38, 32, 34, 30, 32, 34, 28, 30, 26, 28, 30, 24, 26],
                'Broad Jump': [122, 125, 120, 122, 128, 118, 120, 122, 115, 118, 112, 115, 118, 108, 112, 105, 108, 112, 102, 105],
                'Shuttle': [4.00, 3.95, 4.05, 4.00, 3.90, 4.10, 4.05, 4.00, 4.15, 4.10, 4.20, 4.15, 4.10, 4.25, 4.20, 4.30, 4.25, 4.20, 4.35, 4.30],
                'Bench': [15, 17, 13, 15, 18, 12, 13, 15, 10, 12, 8, 10, 12, 6, 8, 5, 6, 8, 4, 5]
            }
        else:
            logger.warning(f"Unknown position: {position}, creating minimal dummy")
            dummy_data = {
                'Player_Name': ['Test Player'],
                'Division': ['FCS'],
                'Height': [72],
                'Weight': [200]
            }

        # Save dummy data
        df = pd.DataFrame(dummy_data)
        df.to_csv(local_path, index=False)
        logger.info(f"📝 Created dummy data for {position.upper()} at {local_path}")
        return True

    def get_model_versions(self, position: str) -> Dict[str, Any]:
        """
        Get available model versions from blob or local storage

        Args:
            position: Position (qb, rb, wr)

        Returns:
            Dictionary of version info
        """
        versions = {}

        if self.use_blob:
            try:
                if self.container_client:
                    # Container-specific SAS URL - would need models container access
                    logger.warning("Container-specific SAS URL doesn't support model listing")
                    return self._get_local_versions(position)
                else:
                    # Account-level SAS URL
                    container_name = "recruit-reveal-models"
                    container_client = self.blob_service.get_container_client(container_name)

                    prefix = f"recruit_reveal_{position}_pipeline_v"
                    for blob in container_client.list_blobs(name_starts_with=prefix):
                        if blob.name.endswith('.pkl'):
                            version = blob.name.split('_v')[1].split('.pkl')[0]
                            versions[version] = {
                                'blob_name': blob.name,
                                'size': blob.size,
                                'last_modified': blob.last_modified.isoformat()
                            }

                    logger.info(f"Found {len(versions)} versions for {position.upper()} in blob")

            except Exception as e:
                logger.warning(f"Failed to list blob versions: {e}")
                return self._get_local_versions(position)
        else:
            return self._get_local_versions(position)

        return versions

    def _get_local_versions(self, position: str) -> Dict[str, Any]:
        """Get model versions from local storage"""
        versions = {}
        models_dir = Path("models")

        if models_dir.exists():
            pattern = f"recruit_reveal_{position}_pipeline_v*.pkl"
            for model_file in models_dir.glob(pattern):
                version = model_file.stem.split('_v')[1]
                versions[version] = {
                    'file_path': str(model_file),
                    'size': model_file.stat().st_size,
                    'last_modified': model_file.stat().st_mtime
                }

        logger.info(f"Found {len(versions)} local versions for {position.upper()}")
        return versions

# Singleton instance
_blob_client = None

def get_blob_client() -> AzureBlobClient:
    """Get or create singleton blob client"""
    global _blob_client
    if _blob_client is None:
        _blob_client = AzureBlobClient()
    return _blob_client