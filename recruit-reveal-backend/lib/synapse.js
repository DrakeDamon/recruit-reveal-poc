// lib/synapse.js
import { DefaultAzureCredential } from "@azure/identity";
import { SynapsePipelineClient } from "@azure/arm-synapse";

export async function triggerPipeline(athleteData) {
  const cred = new DefaultAzureCredential();
  const client = new SynapsePipelineClient(
    process.env.AZURE_SUBSCRIPTION_ID,
    process.env.AZURE_RESOURCE_GROUP,
    process.env.AZURE_SYNAPSE_WORKSPACE,
    cred
  );
  const run = await client.pipeline.createRun(process.env.AZURE_PIPELINE_NAME, {
    // here pass your parameters, e.g. athleteData JSON
    parameters: { athlete: athleteData },
  });
  return run.runId;
}
