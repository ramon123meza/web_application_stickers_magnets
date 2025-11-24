#!/usr/bin/env python3
"""
Test script to verify that create_order Lambda function handles the new frontend data structure correctly.

Tests the compatibility between the frontend's order data format and the Lambda function expectations.
"""

import json
import sys
import os

# Add the lambda_functions directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'lambda_functions'))

def test_order_structure_compatibility():
    """Test that the frontend order structure is compatible with the Lambda function."""
    
    print("Testing order structure compatibility...")
    print("=" * 60)
    
    # Sample order data that matches what the frontend now sends
    frontend_order_data = {
        "orderId": "SLMAG-20241124-ABC123",
        "customerInfo": {
            "fullName": "John Test Customer",  # Frontend sends 'fullName'
            "email": "john.test@example.com",
            "phone": "555-123-4567"
        },
        "shippingAddress": {  # Frontend sends as separate object
            "fullName": "John Test Customer",
            "address": "123 Test Street",  # Frontend uses 'address' not 'street'
            "apartment": "Apt 4B",
            "city": "Test City",
            "state": "NY",
            "zip": "12345",
            "country": "USA"
        },
        "items": [
            {
                "productType": "sticker",
                "productName": "Custom Sticker",
                "size": "5x5",
                "shape": "square",
                "quantity": 50,
                "unitPrice": 1.43,
                "totalPrice": 71.50,
                "imageUrl": "https://s3.amazonaws.com/bucket/custom-sticker-preview-123.png",  # Preview image
                "artworkUrl": "https://s3.amazonaws.com/bucket/custom-sticker-source-123.png",
                "instructions": "Please cut carefully around the edges"
            }
        ],
        "subtotal": 71.50,
        "shipping": 0,
        "total": 71.50,
        "paymentInfo": {
            "method": "test_card",
            "isTestData": True,
            "last4": "4242"
        },
        "orderDate": "2024-11-24T12:00:00Z",
        "status": "pending"
    }
    
    print("Frontend order data structure:")
    print(json.dumps(frontend_order_data, indent=2))
    print("\n" + "=" * 60)
    
    try:
        # Import the Lambda function
        from create_order import prepare_order_record, validate_customer_info, validate_items
        
        print("✓ Successfully imported Lambda function modules")
        
        # Test validation
        customer_info = frontend_order_data.get('customerInfo', {})
        shipping_address = frontend_order_data.get('shippingAddress', {})
        
        print(f"✓ Testing customer validation with:")
        print(f"  - Customer Info: {customer_info}")
        print(f"  - Shipping Address: {shipping_address}")
        
        customer_errors = validate_customer_info(customer_info, shipping_address)
        
        if customer_errors:
            print(f"✗ Customer validation failed: {customer_errors}")
            return False
        else:
            print("✓ Customer validation passed")
        
        # Test item validation
        items = frontend_order_data.get('items', [])
        item_errors = validate_items(items)
        
        if item_errors:
            print(f"✗ Item validation failed: {item_errors}")
            return False
        else:
            print("✓ Item validation passed")
        
        # Test order record preparation
        print("\n" + "-" * 40)
        print("Testing order record preparation...")
        
        order_record = prepare_order_record(frontend_order_data)
        
        print("✓ Order record prepared successfully")
        print("\nGenerated order record structure:")
        print(json.dumps(order_record, indent=2, default=str))
        
        # Verify key fields are correctly mapped
        print("\n" + "-" * 40)
        print("Verifying field mappings...")
        
        # Check customer name mapping
        expected_name = frontend_order_data['customerInfo']['fullName']
        actual_name = order_record['customerInfo']['name']
        
        if expected_name == actual_name:
            print(f"✓ Customer name mapped correctly: {actual_name}")
        else:
            print(f"✗ Customer name mapping failed: expected '{expected_name}', got '{actual_name}'")
            return False
        
        # Check address mapping
        expected_address = frontend_order_data['shippingAddress']['address']
        actual_address = order_record['customerInfo']['shippingAddress']['street']
        
        if expected_address == actual_address:
            print(f"✓ Address mapped correctly: {actual_address}")
        else:
            print(f"✗ Address mapping failed: expected '{expected_address}', got '{actual_address}'")
            return False
        
        # Check image URL mapping
        expected_image_url = frontend_order_data['items'][0]['artworkUrl']
        actual_image_url = order_record['items'][0]['artworkS3Url']
        
        if expected_image_url == actual_image_url:
            print(f"✓ Image URL mapped correctly: {actual_image_url}")
        else:
            print(f"✗ Image URL mapping failed: expected '{expected_image_url}', got '{actual_image_url}'")
            return False
        
        # Check payment info
        if 'paymentInfo' in order_record:
            print(f"✓ Payment info preserved: {order_record['paymentInfo']}")
        else:
            print("✗ Payment info not preserved")
            return False
        
        print("\n" + "=" * 60)
        print("🎉 ALL TESTS PASSED!")
        print("✓ Frontend order structure is fully compatible with Lambda function")
        print("✓ Field mappings are working correctly")
        print("✓ Validation logic handles both old and new formats")
        return True
        
    except ImportError as e:
        print(f"✗ Failed to import Lambda function: {e}")
        print("Note: This test requires the Lambda function files to be available")
        return False
    except Exception as e:
        print(f"✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_backward_compatibility():
    """Test that the Lambda function still works with old data structures."""
    
    print("\n" + "=" * 60)
    print("Testing backward compatibility with old data structure...")
    
    # Old structure that the Lambda function originally expected
    old_order_data = {
        "customerInfo": {
            "name": "John Doe",  # Old format used 'name'
            "email": "john@example.com",
            "phone": "555-123-4567",
            "shippingAddress": {  # Old format nested shipping in customerInfo
                "street": "123 Main St",  # Old format used 'street'
                "apartment": "Apt 4B",
                "city": "New York",
                "state": "NY",
                "zip": "10001",
                "country": "USA"
            }
        },
        "items": [
            {
                "productType": "die_cut_sticker",
                "size": "5x5",
                "quantity": 50,
                "unitPrice": 1.43,
                "totalPrice": 71.25,
                "artworkS3Url": "s3://bucket/test-123.png",  # Old format used artworkS3Url
                "instructions": "Please cut carefully"
            }
        ],
        "shipping": 0
    }
    
    try:
        from create_order import prepare_order_record, validate_customer_info, validate_items
        
        # Extract info in old format
        customer_info = old_order_data.get('customerInfo', {})
        shipping_address = customer_info.get('shippingAddress', {})
        
        # Test validation
        customer_errors = validate_customer_info(customer_info, shipping_address)
        if customer_errors:
            print(f"✗ Old format validation failed: {customer_errors}")
            return False
        
        # Test order record preparation
        order_record = prepare_order_record(old_order_data)
        
        print("✓ Backward compatibility test passed")
        print(f"✓ Old 'name' field mapped: {order_record['customerInfo']['name']}")
        print(f"✓ Old 'street' field mapped: {order_record['customerInfo']['shippingAddress']['street']}")
        print(f"✓ Old 'artworkS3Url' field mapped: {order_record['items'][0]['artworkS3Url']}")
        
        return True
        
    except Exception as e:
        print(f"✗ Backward compatibility test failed: {e}")
        return False

if __name__ == "__main__":
    print("Lambda Function Compatibility Test")
    print("Testing create_order.py with new frontend data structure")
    print()
    
    # Test new structure
    success1 = test_order_structure_compatibility()
    
    # Test old structure
    success2 = test_backward_compatibility()
    
    if success1 and success2:
        print("\n🎉 ALL COMPATIBILITY TESTS PASSED!")
        print("✓ Lambda function is ready for production")
        print("✓ Frontend integration will work correctly") 
        print("✓ Existing functionality remains intact")
    else:
        print("\n❌ SOME TESTS FAILED")
        print("Please check the Lambda function implementation")
        sys.exit(1)
