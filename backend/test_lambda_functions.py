#!/usr/bin/env python3
"""
Test script for diagnosing Lambda function issues.
Tests each function with realistic payloads and reports errors.
"""

import json
import base64
import os
import sys
import time
from datetime import datetime
from pathlib import Path

# Add lambda_functions directory to path
sys.path.insert(0, str(Path(__file__).parent / 'lambda_functions'))

# Configure AWS region
os.environ['AWS_REGION'] = 'us-east-1'
os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'

# Configure environment variables for Lambda functions
os.environ['S3_BUCKET'] = 'layout-tool-randr'
os.environ['FROM_EMAIL'] = 'orders@stickermagnetlab.com'
os.environ['COMPANY_EMAIL'] = 'info@stickermagnetlab.com'
os.environ['COMPANY_NAME'] = 'Sticker & Magnet Lab'
os.environ['WEBSITE_URL'] = 'https://stickermagnetlab.com'

def print_header(test_name):
    """Print a formatted test header."""
    print(f"\n{'='*60}")
    print(f"Testing: {test_name}")
    print(f"{'='*60}")

def print_result(success, message="", details=None):
    """Print test result."""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if details:
        print(f"Details: {json.dumps(details, indent=2)}")

def test_get_products():
    """Test the get_products Lambda function."""
    print_header("Get Products")
    
    try:
        from get_products import lambda_handler
        
        # Test event
        event = {
            'httpMethod': 'GET',
            'queryStringParameters': None
        }
        
        response = lambda_handler(event, None)
        body = json.loads(response['body'])
        
        if response['statusCode'] == 200 and body.get('success'):
            print_result(True, f"Retrieved {len(body.get('products', []))} products")
            # Show first product as example
            if body.get('products'):
                print(f"Example product: {body['products'][0]['name']}")
        else:
            print_result(False, "Failed to retrieve products", body)
            
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        import traceback
        traceback.print_exc()

def test_get_pricing():
    """Test the get_pricing Lambda function."""
    print_header("Get Pricing")
    
    try:
        from get_pricing import lambda_handler
        
        # Test different product types
        test_cases = [
            {'type': 'sticker', 'size': '5x5'},
            {'type': 'magnet', 'size': '5x5'},
            {'type': 'fridge', 'productSize': '2x3'}  # Fridge magnets use productSize parameter
        ]
        
        for test_case in test_cases:
            event = {
                'httpMethod': 'GET',
                'queryStringParameters': test_case
            }
            
            response = lambda_handler(event, None)
            body = json.loads(response['body'])
            
            if response['statusCode'] == 200 and body.get('success'):
                print_result(True, f"Got pricing for {test_case}")
                # Show sample prices
                if body.get('pricing'):
                    sample = body['pricing'][0] if body['pricing'] else None
                    if sample:
                        print(f"  Sample: {sample['quantity']} qty = ${sample['price']}")
            else:
                print_result(False, f"Failed for {test_case}", body)
                
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        import traceback
        traceback.print_exc()

def test_upload_image():
    """Test the upload_image_to_s3 Lambda function."""
    print_header("Upload Image to S3")
    
    try:
        from upload_image_to_s3 import lambda_handler
        
        # Create a simple 1x1 transparent PNG for testing
        test_png_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        event = {
            'httpMethod': 'POST',
            'body': json.dumps({
                'image': test_png_base64,
                'filename': 'test.png',
                'sessionId': 'test-session-123'
            })
        }
        
        response = lambda_handler(event, None)
        body = json.loads(response['body'])
        
        if response['statusCode'] == 200 and body.get('success'):
            print_result(True, "Image uploaded successfully")
            print(f"  S3 URL: {body.get('s3Url')}")
            print(f"  HTTPS URL: {body.get('httpsUrl')}")
        else:
            print_result(False, "Failed to upload image", body)
            
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        import traceback
        traceback.print_exc()

def test_contact_form():
    """Test the contact_form Lambda function."""
    print_header("Contact Form")
    
    try:
        from contact_form import lambda_handler
        
        test_payload = {
            'name': 'Test User',
            'email': 'test@example.com',
            'subject': 'Test Contact Form',
            'message': 'This is a test message from the diagnostic script.',
            'timestamp': datetime.now().isoformat()
        }
        
        event = {
            'httpMethod': 'POST',
            'body': json.dumps(test_payload)
        }
        
        response = lambda_handler(event, None)
        body = json.loads(response['body'])
        
        if response['statusCode'] == 200 and body.get('success'):
            print_result(True, "Contact form processed successfully")
            print(f"  Contact ID: {body.get('contactId')}")
        else:
            print_result(False, "Failed to process contact form", body)
            
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        import traceback
        traceback.print_exc()

def test_send_order_confirmation():
    """Test the send_order_confirmation Lambda function."""
    print_header("Send Order Confirmation")
    
    try:
        from send_order_confirmation import lambda_handler
        
        # Create test order data for email confirmation
        test_order = {
            'orderId': f'TEST-{int(time.time())}',
            'orderDate': datetime.now().isoformat(),
            'customerInfo': {
                'name': 'Test Customer',
                'email': 'test@example.com',
                'phone': '555-0123',
                'shippingAddress': {
                    'street': '123 Test St',
                    'city': 'Test City',
                    'state': 'CA',
                    'zip': '12345',
                    'country': 'US'
                }
            },
            'items': [
                {
                    'productName': 'Custom Sticker',
                    'productType': 'sticker',
                    'size': '5x5',
                    'quantity': 50,
                    'totalPrice': 25.99,
                    'artworkUrl': 's3://layout-tool-randr/test-image.png',
                    'instructions': 'Test instructions'
                }
            ],
            'subtotal': 25.99,
            'shipping': 0.00,
            'total': 25.99
        }
        
        event = {
            'order': test_order
        }
        
        response = lambda_handler(event, None)
        
        if response.get('success'):
            print_result(True, "Order confirmation processed")
            print(f"  Customer email sent: {response.get('customerEmailSent', False)}")
            print(f"  Staff email sent: {response.get('staffEmailSent', False)}")
        else:
            print_result(False, "Failed to send order confirmation", response)
            
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        import traceback
        traceback.print_exc()

def test_create_order():
    """Test the create_order Lambda function."""
    print_header("Create Order")
    
    try:
        from create_order import lambda_handler
        
        # Create test order data with correct structure
        test_order = {
            'name': 'Test Customer',
            'email': 'test@example.com',
            'phone': '555-0123',
            'shippingAddress': {
                'street': '123 Test St',
                'line2': '',
                'city': 'Test City',
                'state': 'CA',
                'zip': '12345',
                'country': 'US'
            },
            'billingAddress': {
                'street': '123 Test St',
                'line2': '',
                'city': 'Test City',
                'state': 'CA',
                'zip': '12345',
                'country': 'US'
            },
            'items': [
                {
                    'productId': 'PROD-12345678',
                    'productName': 'Custom Sticker',
                    'productType': 'sticker',
                    'size': '5x5',
                    'quantity': 50,
                    'price': 25.99,
                    'imageUrl': 's3://layout-tool-randr/test-image.png',
                    'instructions': 'Test instructions'
                }
            ]
        }
        
        event = {
            'httpMethod': 'POST',
            'body': json.dumps(test_order)
        }
        
        response = lambda_handler(event, None)
        body = json.loads(response['body'])
        
        if response['statusCode'] == 200 and body.get('success'):
            print_result(True, "Order created successfully")
            print(f"  Order ID: {body.get('orderId')}")
            print(f"  Total: ${body.get('total')}")
        else:
            print_result(False, "Failed to create order", body)
            
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        import traceback
        traceback.print_exc()

def main():
    """Run all tests."""
    print("\n" + "="*60)
    print("LAMBDA FUNCTION DIAGNOSTIC TEST")
    print("="*60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run tests
    test_get_products()
    test_get_pricing()
    test_upload_image()
    test_contact_form()
    test_create_order()
    test_send_order_confirmation()
    
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    print("Check the output above for any failures.")
    print("Common issues to check:")
    print("1. Missing AWS credentials")
    print("2. DynamoDB tables not created")
    print("3. S3 bucket permissions")
    print("4. SES configuration for emails")
    print("5. Environment variables not set")

if __name__ == '__main__':
    main()