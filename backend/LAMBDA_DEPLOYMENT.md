# Lambda Function Deployment Guide

This guide explains how to deploy the Lambda functions for the Sticker & Magnet Lab application.

## Overview

The backend consists of several Lambda functions that handle different aspects of the application:
- **Contact Form**: `contact_form.py` (deployed with handler `contact_form.lambda_handler`)
- **Send Order Confirmation**: `send_order_confirmation.py` (deployed as `lambda_function.py` with handler `lambda_function.lambda_handler`)
- **Create Order**: `create_order.py`
- **Get Products**: `get_products.py`
- **Get Pricing**: `get_pricing.py`
- **Upload Image to S3**: `upload_image_to_s3.py`

## Lambda Function Structure

Each Lambda function should be deployed with:
1. The main Python file
2. The `email_templates_inline.py` file (for functions that send emails)
3. Required dependencies installed

## Deployment Steps

### 1. Contact Form Lambda

**Files to include:**
- `contact_form.py`
- `email_templates_inline.py`

**Configuration:**
- Handler: `contact_form.lambda_handler`
- Function URL: `https://ccphcykjv3tsgazhh63aivdyoq0tntve.lambda-url.us-east-1.on.aws/`
- Environment Variables:
  ```
  FROM_EMAIL=orders@rrinconline.com
  STAFF_EMAILS=arturo@rrinconline.com,ramonecardonna@gmail.com
  CONTACTS_TABLE=sticker_magnet_lab_contacts
  STORE_CONTACTS=true
  ```

### 2. Send Order Confirmation Lambda

**Files to include:**
- `send_order_confirmation.py` → **rename to** `lambda_function.py`
- `email_templates_inline.py`

**Configuration:**
- Function name: `send_order_confirmation`
- Handler: `lambda_function.lambda_handler`
- Environment Variables:
  ```
  FROM_EMAIL=orders@rrinconline.com
  STAFF_EMAILS=arturo@rrinconline.com,ramonecardonna@gmail.com
  PRESIGNED_URL_EXPIRY_DAYS=7
  ```

### 3. Other Lambda Functions

For `create_order.py`, `get_products.py`, `get_pricing.py`, and `upload_image_to_s3.py`:

**Configuration:**
- Handler: `{filename}.lambda_handler` (e.g., `create_order.lambda_handler`)
- Environment Variables:
  ```
  # S3 Configuration
  S3_BUCKET=layout-tool-randr
  S3_PREFIX=orders/
  MAX_FILE_SIZE=10485760
  
  # DynamoDB Tables
  PRODUCTS_TABLE=sticker_magnet_lab_products
  PRICING_STICKERS_TABLE=sticker_magnet_lab_pricing_stickers
  PRICING_MAGNETS_TABLE=sticker_magnet_lab_pricing_magnets
  PRICING_FRIDGE_MAGNETS_TABLE=sticker_magnet_lab_pricing_fridge_magnets
  ORDERS_TABLE=sticker_magnet_lab_orders
  
  # Email Configuration
  FROM_EMAIL=orders@rrinconline.com
  COMPANY_EMAIL=info@rrinconline.com
  ```

## Dependencies

Create a `requirements.txt` file for Lambda deployment:
```
boto3>=1.34.0
botocore>=1.34.0
```

## Deployment Process

### Using AWS Console

1. Create a deployment package:
   ```bash
   # Create deployment directory
   mkdir lambda-deployment
   cp {function-files} lambda-deployment/
   cd lambda-deployment
   
   # Install dependencies
   pip install -r requirements.txt -t .
   
   # Create ZIP file
   zip -r function-deployment.zip .
   ```

2. Upload to Lambda:
   - Go to AWS Lambda Console
   - Create/update function
   - Upload ZIP file
   - Set handler and environment variables

### Using AWS CLI

```bash
# Update function code
aws lambda update-function-code \
  --function-name {function-name} \
  --zip-file fileb://function-deployment.zip

# Update environment variables
aws lambda update-function-configuration \
  --function-name {function-name} \
  --environment Variables='{key1=value1,key2=value2}'
```

## Required AWS Permissions

### DynamoDB Permissions
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:PutItem",
                "dynamodb:GetItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Scan",
                "dynamodb:Query"
            ],
            "Resource": [
                "arn:aws:dynamodb:us-east-1:*:table/sticker_magnet_lab_*"
            ]
        }
    ]
}
```

### S3 Permissions
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": [
                "arn:aws:s3:::layout-tool-randr/*"
            ]
        }
    ]
}
```

### SES Permissions
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ses:SendEmail",
                "ses:SendRawEmail"
            ],
            "Resource": "*"
        }
    ]
}
```

## Testing

Use the provided test script to verify Lambda functions:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python test_lambda_functions.py
```

## Common Issues

### 1. Email Templates Not Found
**Problem:** Lambda functions can't import email templates from utils directory.
**Solution:** Ensure `email_templates_inline.py` is included in the deployment package.

### 2. Missing AWS Credentials
**Problem:** Functions fail with "Unable to locate credentials".
**Solution:** Configure IAM role with proper permissions for Lambda execution.

### 3. DynamoDB Tables Not Found
**Problem:** Functions fail to connect to DynamoDB tables.
**Solution:** 
- Run `database_setup.py` to create tables
- Verify table names match environment variables
- Check IAM permissions for DynamoDB access

### 4. Parameter Validation Errors
**Problem:** API calls fail with missing parameter errors.
**Solution:** 
- `get_pricing`: Use parameter `type` (not `productType`)
- `create_order`: Nest shipping address under customer info
- Check API documentation for correct parameter structure

## Monitoring

- Check CloudWatch Logs for function execution logs
- Monitor CloudWatch Metrics for function performance
- Set up CloudWatch Alarms for error rates

## Notes

1. The `send_order_confirmation` function is designed to be invoked by the `create_order` function
2. Contact form Lambda has a public URL endpoint for direct HTTP access
3. All email-sending functions require SES configuration and verified email domains
4. Image upload function requires S3 bucket with proper permissions