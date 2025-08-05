const axios = require('axios');

// Test webhook endpoint
async function testWebhook() {
  try {
    console.log('🧪 Testing webhook endpoint...');
    
    const testData = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_intent: 'pi_test_123',
          amount_total: 50000, // $500.00
          currency: 'usd',
          customer_details: {
            email: 'test@example.com'
          },
          metadata: {
            vehicle_id: '1',
            user_id: '1',
            payment_type: 'purchase',
            vehicle_price: '50000',
            stock_number: 'TEST123'
          }
        }
      }
    };

    const response = await axios.post('http://localhost:3001/api/payments/webhook-test', testData);
    console.log('✅ Webhook test response:', response.data);
    
  } catch (error) {
    console.error('❌ Webhook test failed:', error.message);
  }
}

// Test vehicle status update
async function testVehicleStatus() {
  try {
    console.log('🚗 Testing vehicle status update...');
    
    // This would test the actual database update logic
    // For now, just check if the endpoint is accessible
    const response = await axios.get('http://localhost:3001/api/payments/test');
    console.log('✅ Vehicle status test response:', response.data);
    
  } catch (error) {
    console.error('❌ Vehicle status test failed:', error.message);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting webhook diagnostics...\n');
  
  await testWebhook();
  console.log('');
  await testVehicleStatus();
  
  console.log('\n📋 Next steps:');
  console.log('1. Check your backend logs for webhook events');
  console.log('2. Verify Stripe webhook URL is configured correctly');
  console.log('3. Test with a real payment to see detailed logs');
}

runTests(); 