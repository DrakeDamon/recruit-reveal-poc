#!/usr/bin/env python3
"""
Smoke Test Script for Recruit Reveal ML API

This script performs basic validation of the ML API endpoints to ensure
the service is working correctly after deployment or model updates.

Usage:
    python scripts/smoke_test_api.py
    python scripts/smoke_test_api.py --host http://localhost:8000
    python scripts/smoke_test_api.py --host https://your-api.render.com
"""

import argparse
import json
import sys
import time
from typing import Dict, Any, List
import requests
from requests.exceptions import RequestException, ConnectionError, Timeout

# Configure requests session with retries
session = requests.Session()
session.timeout = 30

def test_health_endpoint(base_url: str) -> Dict[str, Any]:
    """Test the health check endpoint"""
    print("🏥 Testing health endpoint...")
    
    try:
        response = session.get(f"{base_url}/health")
        response.raise_for_status()
        
        data = response.json()
        
        # Validate response structure
        required_fields = ['status', 'models_loaded', 'available_positions']
        for field in required_fields:
            if field not in data:
                return {
                    'status': 'FAIL',
                    'error': f'Missing required field: {field}',
                    'response': data
                }
        
        if data['status'] != 'healthy':
            return {
                'status': 'FAIL',
                'error': f'Unhealthy status: {data["status"]}',
                'response': data
            }
        
        if data['models_loaded'] == 0:
            return {
                'status': 'WARN',
                'error': 'No models loaded',
                'response': data
            }
        
        return {
            'status': 'PASS',
            'models_loaded': data['models_loaded'],
            'positions': data['available_positions'],
            'response': data
        }
        
    except ConnectionError:
        return {
            'status': 'FAIL',
            'error': 'Connection refused - API server not running',
            'response': None
        }
    except Timeout:
        return {
            'status': 'FAIL',
            'error': 'Request timeout - API server not responding',
            'response': None
        }
    except RequestException as e:
        return {
            'status': 'FAIL',
            'error': f'Request failed: {str(e)}',
            'response': None
        }
    except Exception as e:
        return {
            'status': 'FAIL',
            'error': f'Unexpected error: {str(e)}',
            'response': None
        }

def test_models_endpoint(base_url: str) -> Dict[str, Any]:
    """Test the models information endpoint"""
    print("📚 Testing models endpoint...")
    
    try:
        response = session.get(f"{base_url}/models")
        response.raise_for_status()
        
        data = response.json()
        
        # Validate response structure
        if 'available_models' not in data:
            return {
                'status': 'FAIL',
                'error': 'Missing available_models field',
                'response': data
            }
        
        available_models = data['available_models']
        expected_positions = ['qb', 'rb', 'wr']
        
        loaded_positions = []
        for position in expected_positions:
            if position in available_models and available_models[position].get('loaded', False):
                loaded_positions.append(position)
        
        if not loaded_positions:
            return {
                'status': 'FAIL',
                'error': 'No models loaded for any position',
                'response': data
            }
        
        return {
            'status': 'PASS',
            'loaded_positions': loaded_positions,
            'total_models': data.get('total_models', 0),
            'total_versions': data.get('total_versions', 0),
            'response': data
        }
        
    except Exception as e:
        return {
            'status': 'FAIL',
            'error': f'Error testing models endpoint: {str(e)}',
            'response': None
        }

def test_prediction_endpoint(base_url: str, position: str) -> Dict[str, Any]:
    """Test prediction endpoint for a specific position"""
    print(f"🎯 Testing prediction endpoint for {position.upper()}...")
    
    # Sample test data for each position
    test_data = {
        'qb': {
            'position': 'qb',
            'height_inches': 72,
            'weight_lbs': 200,
            'forty_yard_dash': 4.7,
            'senior_ypg': 250,
            'senior_tds': 20,
            'senior_comp_pct': 65.0,
            'name': 'Test QB Player'
        },
        'rb': {
            'position': 'rb',
            'height_inches': 70,
            'weight_lbs': 190,
            'forty_yard_dash': 4.4,
            'senior_ypg': 120,
            'senior_ypc': 5.2,
            'senior_tds': 15,
            'name': 'Test RB Player'
        },
        'wr': {
            'position': 'wr',
            'height_inches': 71,
            'weight_lbs': 180,
            'forty_yard_dash': 4.5,
            'senior_rec_ypg': 85,
            'senior_rec': 55,
            'senior_avg': 15.5,
            'name': 'Test WR Player'
        }
    }
    
    if position not in test_data:
        return {
            'status': 'FAIL',
            'error': f'No test data available for position: {position}',
            'response': None
        }
    
    try:
        payload = test_data[position]
        
        response = session.post(
            f"{base_url}/predict",
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        response.raise_for_status()
        
        data = response.json()
        
        # Validate response structure
        required_fields = [
            'predicted_division', 'confidence_score', 'position',
            'notes', 'goals', 'switches', 'calendar_advice'
        ]
        
        for field in required_fields:
            if field not in data:
                return {
                    'status': 'FAIL',
                    'error': f'Missing required field in prediction response: {field}',
                    'response': data
                }
        
        # Validate prediction values
        if data['position'].lower() != position.lower():
            return {
                'status': 'FAIL',
                'error': f'Position mismatch: expected {position}, got {data["position"]}',
                'response': data
            }
        
        if not (0 <= data['confidence_score'] <= 1):
            return {
                'status': 'FAIL',
                'error': f'Invalid confidence score: {data["confidence_score"]}',
                'response': data
            }
        
        valid_divisions = ['D3', 'NAIA', 'D2', 'FCS', 'Power 5']
        if data['predicted_division'] not in valid_divisions:
            return {
                'status': 'FAIL',
                'error': f'Invalid predicted division: {data["predicted_division"]}',
                'response': data
            }
        
        return {
            'status': 'PASS',
            'predicted_division': data['predicted_division'],
            'confidence': data['confidence_score'],
            'model_version': data.get('model_version', 'unknown'),
            'response': data
        }
        
    except Exception as e:
        return {
            'status': 'FAIL',
            'error': f'Error testing prediction for {position}: {str(e)}',
            'response': None
        }

def test_root_endpoint(base_url: str) -> Dict[str, Any]:
    """Test the root endpoint"""
    print("🏠 Testing root endpoint...")
    
    try:
        response = session.get(f"{base_url}/")
        response.raise_for_status()
        
        data = response.json()
        
        if 'status' not in data or data['status'] != 'healthy':
            return {
                'status': 'FAIL',
                'error': f'Unexpected root response: {data}',
                'response': data
            }
        
        return {
            'status': 'PASS',
            'service': data.get('service', 'unknown'),
            'version': data.get('version', 'unknown'),
            'response': data
        }
        
    except Exception as e:
        return {
            'status': 'FAIL',
            'error': f'Error testing root endpoint: {str(e)}',
            'response': None
        }

def run_smoke_tests(base_url: str, verbose: bool = False) -> Dict[str, Any]:
    """Run all smoke tests and return results"""
    print("=" * 80)
    print("🧪 RECRUIT REVEAL ML API SMOKE TESTS")
    print("=" * 80)
    print(f"Target URL: {base_url}")
    print()
    
    results = {}
    
    # Test 1: Root endpoint
    results['root'] = test_root_endpoint(base_url)
    print_result("Root Endpoint", results['root'], verbose)
    
    # Test 2: Health endpoint
    results['health'] = test_health_endpoint(base_url)
    print_result("Health Endpoint", results['health'], verbose)
    
    # Test 3: Models endpoint
    results['models'] = test_models_endpoint(base_url)
    print_result("Models Endpoint", results['models'], verbose)
    
    # Test 4: Prediction endpoints (only if models are loaded)
    results['predictions'] = {}
    
    if results['health']['status'] == 'PASS' and results['health'].get('models_loaded', 0) > 0:
        for position in ['qb', 'rb', 'wr']:
            results['predictions'][position] = test_prediction_endpoint(base_url, position)
            print_result(f"Prediction ({position.upper()})", results['predictions'][position], verbose)
    else:
        print("⚠️  Skipping prediction tests - no models loaded")
        results['predictions'] = {'skipped': 'No models loaded'}
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 SMOKE TEST SUMMARY")
    print("=" * 80)
    
    total_tests = 0
    passed_tests = 0
    failed_tests = 0
    warnings = 0
    
    for test_name, result in results.items():
        if test_name == 'predictions':
            if isinstance(result, dict) and 'skipped' not in result:
                for pos, pred_result in result.items():
                    total_tests += 1
                    if pred_result['status'] == 'PASS':
                        passed_tests += 1
                    elif pred_result['status'] == 'WARN':
                        warnings += 1
                    else:
                        failed_tests += 1
        else:
            total_tests += 1
            if result['status'] == 'PASS':
                passed_tests += 1
            elif result['status'] == 'WARN':
                warnings += 1
            else:
                failed_tests += 1
    
    print(f"✅ Passed: {passed_tests}")
    print(f"⚠️  Warnings: {warnings}")
    print(f"❌ Failed: {failed_tests}")
    print(f"📋 Total: {total_tests}")
    
    success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
    print(f"🎯 Success Rate: {success_rate:.1f}%")
    
    overall_status = 'PASS' if failed_tests == 0 else 'FAIL'
    if warnings > 0 and failed_tests == 0:
        overall_status = 'WARN'
    
    print(f"\n🏆 Overall Status: {overall_status}")
    
    if overall_status == 'PASS':
        print("🎉 All tests passed! API is ready for production.")
    elif overall_status == 'WARN':
        print("⚠️  Tests passed with warnings. Review issues before production.")
    else:
        print("❌ Tests failed. API needs attention before production deployment.")
    
    return {
        'overall_status': overall_status,
        'summary': {
            'total': total_tests,
            'passed': passed_tests,
            'warnings': warnings,
            'failed': failed_tests,
            'success_rate': success_rate
        },
        'detailed_results': results
    }

def print_result(test_name: str, result: Dict[str, Any], verbose: bool = False):
    """Print formatted test result"""
    status = result['status']
    
    if status == 'PASS':
        print(f"✅ {test_name}: PASS")
    elif status == 'WARN':
        print(f"⚠️  {test_name}: WARNING - {result.get('error', 'Unknown warning')}")
    else:
        print(f"❌ {test_name}: FAIL - {result.get('error', 'Unknown error')}")
    
    if verbose and 'response' in result and result['response']:
        print(f"   Response: {json.dumps(result['response'], indent=2)}")
    
    print()

def main():
    """Main entry point for smoke test script"""
    parser = argparse.ArgumentParser(
        description="Smoke test script for Recruit Reveal ML API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test local development server
  python scripts/smoke_test_api.py
  
  # Test custom host
  python scripts/smoke_test_api.py --host http://localhost:8080
  
  # Test production deployment
  python scripts/smoke_test_api.py --host https://your-api.render.com
  
  # Verbose output with full responses
  python scripts/smoke_test_api.py --verbose
        """
    )
    
    parser.add_argument(
        '--host',
        default='http://localhost:8000',
        help='API host URL (default: http://localhost:8000)'
    )
    
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose output with full API responses'
    )
    
    parser.add_argument(
        '--timeout',
        type=int,
        default=30,
        help='Request timeout in seconds (default: 30)'
    )
    
    args = parser.parse_args()
    
    # Configure session timeout
    session.timeout = args.timeout
    
    # Remove trailing slash from host
    base_url = args.host.rstrip('/')
    
    try:
        # Run smoke tests
        results = run_smoke_tests(base_url, args.verbose)
        
        # Exit with appropriate code
        if results['overall_status'] == 'FAIL':
            sys.exit(1)
        elif results['overall_status'] == 'WARN':
            sys.exit(2)
        else:
            sys.exit(0)
            
    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ Smoke test script failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()