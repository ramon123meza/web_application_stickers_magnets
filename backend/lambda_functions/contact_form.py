"""
Lambda function to process contact form submissions.

Endpoint: POST /api/contact
Body: {
    "name": string,
    "email": string,
    "subject": string,
    "message": string
}

Sends notification to staff and auto-reply to customer.
Optionally stores contact in DynamoDB.
"""

import json
import os
import uuid
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

import boto3
from botocore.exceptions import ClientError

# Try to import email templates from utils, fall back to inline templates
try:
    from utils.email_templates import (
        get_contact_auto_reply_html,
        get_contact_notification_html
    )
except ImportError:
    from email_templates_inline import (
        get_contact_auto_reply_html,
        get_contact_notification_html
    )

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
ses_client = boto3.client('ses')
dynamodb = boto3.resource('dynamodb')

# Configuration
FROM_EMAIL = os.environ.get('FROM_EMAIL', 'orders@rrinconline.com')
STAFF_EMAILS = os.environ.get('STAFF_EMAILS', 'arturo@rrinconline.com,ramonecardonna@gmail.com').split(',')
CONTACTS_TABLE = os.environ.get('CONTACTS_TABLE', 'sticker_magnet_lab_contacts')
STORE_CONTACTS = os.environ.get('STORE_CONTACTS', 'true').lower() == 'true'


def build_cors_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build HTTP response with CORS headers.

    Args:
        status_code: HTTP status code
        body: Response body dictionary

    Returns:
        Formatted API Gateway response
    """
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        'body': json.dumps(body)
    }


def validate_email(email: str) -> bool:
    """
    Validate email format.

    Args:
        email: Email address to validate

    Returns:
        True if valid, False otherwise
    """
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def sanitize_input(text: str, max_length: int = 5000) -> str:
    """
    Sanitize user input to prevent XSS and limit length.

    Args:
        text: Input text to sanitize
        max_length: Maximum allowed length

    Returns:
        Sanitized text
    """
    if not text:
        return ''

    # Trim to max length
    text = text[:max_length]

    # Basic HTML entity encoding for display
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    text = text.replace('"', '&quot;')
    text = text.replace("'", '&#x27;')

    return text


def validate_contact_form(data: Dict) -> List[str]:
    """
    Validate contact form data.

    Args:
        data: Form data dictionary

    Returns:
        List of validation errors (empty if valid)
    """
    errors = []

    # Required fields
    if not data.get('name', '').strip():
        errors.append('Name is required')

    if not data.get('email', '').strip():
        errors.append('Email is required')
    elif not validate_email(data.get('email', '')):
        errors.append('Invalid email format')

    if not data.get('message', '').strip():
        errors.append('Message is required')

    # Length validations
    if len(data.get('name', '')) > 200:
        errors.append('Name must be less than 200 characters')

    if len(data.get('subject', '')) > 500:
        errors.append('Subject must be less than 500 characters')

    if len(data.get('message', '')) > 10000:
        errors.append('Message must be less than 10,000 characters')

    return errors


def send_email(to_emails: List[str], subject: str, html_body: str, text_body: str = '') -> bool:
    """
    Send an email via AWS SES.

    Args:
        to_emails: List of recipient email addresses
        subject: Email subject
        html_body: HTML email body
        text_body: Plain text email body (optional)

    Returns:
        True if email sent successfully, False otherwise
    """
    if not text_body:
        # Generate simple text version from HTML
        text_body = html_body.replace('<br>', '\n').replace('</p>', '\n')
        text_body = re.sub('<[^<]+?>', '', text_body)

    try:
        response = ses_client.send_email(
            Source=FROM_EMAIL,
            Destination={
                'ToAddresses': to_emails
            },
            Message={
                'Subject': {
                    'Data': subject,
                    'Charset': 'UTF-8'
                },
                'Body': {
                    'Text': {
                        'Data': text_body,
                        'Charset': 'UTF-8'
                    },
                    'Html': {
                        'Data': html_body,
                        'Charset': 'UTF-8'
                    }
                }
            }
        )
        logger.info(f"Email sent successfully. Message ID: {response['MessageId']}")
        return True

    except ClientError as e:
        logger.error(f"Failed to send email: {str(e)}")
        return False




def store_contact(contact: Dict) -> bool:
    """
    Store contact form submission in DynamoDB.

    Args:
        contact: Contact data to store

    Returns:
        True if stored successfully, False otherwise
    """
    if not STORE_CONTACTS:
        return True

    try:
        table = dynamodb.Table(CONTACTS_TABLE)
        table.put_item(Item=contact)
        logger.info(f"Contact {contact['contactId']} stored in DynamoDB")
        return True

    except ClientError as e:
        logger.error(f"Failed to store contact: {str(e)}")
        return False


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler for POST /api/contact.

    Args:
        event: API Gateway event
        context: Lambda context

    Returns:
        API Gateway response
    """
    logger.info("Processing contact form submission")

    # Handle OPTIONS request for CORS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return build_cors_response(200, {'message': 'CORS preflight successful'})

    try:
        # Parse request body
        body = event.get('body', '')

        if isinstance(body, str):
            try:
                body = json.loads(body)
            except json.JSONDecodeError:
                return build_cors_response(400, {
                    'success': False,
                    'error': 'Invalid JSON in request body'
                })

        # Validate form data
        validation_errors = validate_contact_form(body)
        if validation_errors:
            return build_cors_response(400, {
                'success': False,
                'error': 'Validation failed',
                'details': validation_errors
            })

        # Prepare contact record
        now = datetime.utcnow()
        contact = {
            'contactId': f"CONTACT-{str(uuid.uuid4())[:8]}",
            'name': sanitize_input(body.get('name', '').strip(), 200),
            'email': body.get('email', '').strip().lower(),
            'subject': sanitize_input(body.get('subject', 'General Inquiry').strip(), 500),
            'message': sanitize_input(body.get('message', '').strip(), 10000),
            'timestamp': now.isoformat() + 'Z',
            'status': 'new'
        }

        logger.info(f"Processing contact {contact['contactId']} from {contact['email']}")

        # Store in DynamoDB (optional)
        stored = store_contact(contact)

        # Send staff notification
        staff_subject = f"Contact Form: {contact['subject'][:50]}"
        staff_html = get_contact_notification_html(contact)
        staff_sent = send_email(STAFF_EMAILS, staff_subject, staff_html)

        # Send auto-reply to customer
        reply_subject = "Thank you for contacting Sticker & Magnet Lab"
        reply_html = get_contact_auto_reply_html(contact)
        reply_sent = send_email([contact['email']], reply_subject, reply_html)

        logger.info(f"Contact processed - Staff notified: {staff_sent}, Auto-reply sent: {reply_sent}")

        return build_cors_response(200, {
            'success': True,
            'message': 'Your message has been received. We will get back to you soon!',
            'contactId': contact['contactId']
        })

    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        logger.error(f"AWS error: {error_code} - {error_message}")

        return build_cors_response(500, {
            'success': False,
            'error': 'Failed to process your message. Please try again later.'
        })

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)

        return build_cors_response(500, {
            'success': False,
            'error': 'Internal server error'
        })


# For local testing
if __name__ == '__main__':
    test_contact = {
        'name': 'John Doe',
        'email': 'john@example.com',
        'subject': 'Question about custom stickers',
        'message': 'Hi, I wanted to ask about your custom sticker options.\n\nCan you do holographic stickers?\n\nThanks!'
    }

    test_event = {
        'httpMethod': 'POST',
        'body': json.dumps(test_contact)
    }

    print("Testing contact form handler...")
    # Note: This will fail without AWS credentials configured
    # result = lambda_handler(test_event, None)
    # print(json.dumps(json.loads(result['body']), indent=2))
