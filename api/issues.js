// Vercel Serverless Function - Log new support issues
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST required' });
  }
  
  try {
    // Handle VAPI format
    let sku, issue, caller_info, severity, notes;
    let toolCallId = null;
    
    if (req.body?.message?.toolCallList?.[0]) {
      // VAPI format
      const toolCall = req.body.message.toolCallList[0];
      toolCallId = toolCall.id;
      const args = toolCall.function?.arguments || toolCall.input || toolCall.arguments || {};
      const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
      sku = parsedArgs.sku;
      issue = parsedArgs.issue;
      caller_info = parsedArgs.caller_info;
      severity = parsedArgs.severity || 'medium';
      notes = parsedArgs.notes;
    } else {
      // Direct format
      sku = req.body?.sku;
      issue = req.body?.issue;
      caller_info = req.body?.caller_info;
      severity = req.body?.severity || 'medium';
      notes = req.body?.notes;
    }
    
    if (!issue) {
      const errorMsg = 'Issue description required';
      if (toolCallId) {
        return res.json({ results: [{ toolCallId, result: `Error: ${errorMsg}` }] });
      }
      return res.status(400).json({ error: errorMsg });
    }
    
    // Find product if SKU provided
    let productId = null;
    if (sku) {
      const { data: product } = await supabase
        .from('products')
        .select('id')
        .eq('sku', sku)
        .single();
      
      if (product) productId = product.id;
    }
    
    // Create the issue log
    const { data: newIssue, error } = await supabase
      .from('support_issues')
      .insert({
        product_id: productId,
        sku: sku,
        issue: issue,
        caller_info: caller_info,
        severity: severity,
        notes: notes,
        source: 'vapi_call',
        status: 'new',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      // Table might not exist - create it
      if (error.code === '42P01') {
        await createIssuesTable();
        // Retry insert
        const { data: retryIssue, error: retryError } = await supabase
          .from('support_issues')
          .insert({
            product_id: productId,
            sku: sku,
            issue: issue,
            caller_info: caller_info,
            severity: severity,
            notes: notes,
            source: 'vapi_call',
            status: 'new',
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (retryError) throw retryError;
        
        const successMsg = `Support issue logged successfully. Issue ID: ${retryIssue.id}. A technician will follow up.`;
        if (toolCallId) {
          return res.json({ results: [{ toolCallId, result: successMsg }] });
        }
        return res.json({ success: true, message: successMsg, issue: retryIssue });
      }
      throw error;
    }
    
    const successMsg = `Support issue logged successfully. Issue ID: ${newIssue.id}. A technician will follow up.`;
    
    if (toolCallId) {
      return res.json({ results: [{ toolCallId, result: successMsg }] });
    }
    
    return res.json({ success: true, message: successMsg, issue: newIssue });
    
  } catch (error) {
    console.error('Log issue error:', error);
    const errorMsg = `Failed to log issue: ${error.message}`;
    
    if (req.body?.message?.toolCallList?.[0]?.id) {
      return res.json({ 
        results: [{ 
          toolCallId: req.body.message.toolCallList[0].id, 
          result: errorMsg 
        }] 
      });
    }
    return res.status(500).json({ error: errorMsg });
  }
}

async function createIssuesTable() {
  // This would need to be run manually in Supabase SQL editor
  // Just log the need for now
  console.log('support_issues table needs to be created');
}
