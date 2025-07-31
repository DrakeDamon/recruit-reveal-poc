const { SynapseManagementClient } = require('@azure/arm-synapse');
const { DefaultAzureCredential } = require('@azure/identity');

async function triggerPipeline({ notebookName, pipelineParameters }) {
  const mockMode = String(process.env.MOCK_SYNAPSE).toLowerCase() === 'true';
  console.log('MOCK_SYNAPSE mode:', mockMode, 'raw value:', process.env.MOCK_SYNAPSE);
  
  if (mockMode) {
    console.log('Using mock response');
    const position = pipelineParameters.position;
    
    // Position-specific mock responses
    const mockResponses = {
      QB: {
        score: 69.3,
        predicted_tier: 'FCS',
        notes: 'Solid arm strength with room for improvement in pocket presence',
        probability: 0.693,
        performance_score: 0.70,
        combine_score: 0.65,
        upside_score: 0.10,
        underdog_bonus: 0.05,
        goals: ['Improve 40-yard dash to 4.5s', 'Increase completion percentage'],
        switches: 'Consider switching to WR if arm strength doesn\'t develop',
        calendar_advice: 'Schedule campus visits during April 15-May 24, 2025 contact period'
      },
      RB: {
        score: 71.8,
        predicted_tier: 'FCS',
        notes: 'Good vision and cutting ability, needs to improve breakaway speed',
        probability: 0.718,
        performance_score: 0.75,
        combine_score: 0.68,
        upside_score: 0.12,
        underdog_bonus: 0.08,
        goals: ['Improve 40-yard dash to sub 4.4s', 'Increase receiving yards'],
        switches: 'Consider FB role for Power5 programs',
        calendar_advice: 'Target spring practices for exposure'
      },
      WR: {
        score: 73.5,
        predicted_tier: 'Power5',
        notes: 'Excellent route running and hands, good size for position',
        probability: 0.735,
        performance_score: 0.78,
        combine_score: 0.72,
        upside_score: 0.15,
        underdog_bonus: 0.00,
        goals: ['Improve vertical jump to 38+ inches', 'Increase yards after catch'],
        switches: 'Consider slot receiver role for better matchups',
        calendar_advice: 'Priority visits during official visit weekends in December'
      }
    };
    
    // Return position-specific response or default
    return mockResponses[position] || mockResponses.QB;
  }

  console.log('Using real Synapse pipeline');
  const credential = new DefaultAzureCredential();
  const client = new SynapseManagementClient(credential, process.env.AZURE_SUBSCRIPTION_ID);
  const run = await client.pipelineRuns.create(
    process.env.AZURE_RESOURCE_GROUP,
    process.env.AZURE_SYNAPSE_WORKSPACE,
    process.env.AZURE_PIPELINE_NAME,
    { parameters: pipelineParameters }
  );

  let result;
  const maxWait = 5 * 60 * 1000; // 5 minutes
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const status = await client.pipelineRuns.get(
      process.env.AZURE_RESOURCE_GROUP,
      process.env.AZURE_SYNAPSE_WORKSPACE,
      run.runId
    );
    if (status.status === 'Succeeded') {
      result = { /* Fetch from blob/Postgres, placeholder */
        score: 69.3,
        predicted_tier: 'FCS',
        notes: 'Balanced profile',
        probability: 0.693,
        performance_score: 0.70,
        combine_score: 0.65,
        upside_score: 0.10,
        underdog_bonus: 0.05,
        goals: ['Improve 40-yard dash to 4.5s', 'Increase senior TD passes'],
        switches: 'Consider switching to WR for better Power5 fit',
        calendar_advice: 'Schedule campus visits during April 15-May 24, 2025 contact period'
      };
      break;
    } else if (status.status === 'Failed') {
      throw new Error(`Pipeline failed: ${status.error?.message || 'Unknown error'}`);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  if (!result) throw new Error('Pipeline timed out');
  return result;
}

module.exports = { triggerPipeline };