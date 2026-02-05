// Vercel Serverless Function - Troubleshooting lookup (Supabase)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    // Handle VAPI format
    let sku, issue;
    
    if (req.body?.message?.toolCallList?.[0]) {
      // VAPI format
      const toolCall = req.body.message.toolCallList[0];
      const args = toolCall.function?.arguments || toolCall.input || toolCall.arguments || {};
      const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
      sku = parsedArgs.sku;
      issue = parsedArgs.issue;
      
      // Process and return VAPI format
      const result = await searchTroubleshooting(sku, issue);
      return res.json({
        results: [{
          toolCallId: toolCall.id,
          result: result
        }]
      });
    } else {
      // Direct format
      sku = req.body?.sku || req.query?.sku;
      issue = req.body?.issue || req.query?.issue;
    }
    
    if (!issue) {
      return res.status(400).json({ error: 'Issue description required' });
    }
    
    const result = await searchTroubleshooting(sku, issue);
    return res.json({ success: true, result });
    
  } catch (error) {
    console.error('Troubleshoot error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function searchTroubleshooting(sku, issue) {
  const issueWords = issue.toLowerCase().split(/\s+/);
  
  // Find product if SKU provided
  let productId = null;
  let productInfo = null;
  
  if (sku) {
    const { data: product } = await supabase
      .from('products')
      .select('id, sku, model, full_name')
      .eq('sku', sku)
      .single();
    
    if (product) {
      productId = product.id;
      productInfo = product;
    }
  }
  
  // Search troubleshooting entries
  let query = supabase
    .from('troubleshooting')
    .select(`
      id, issue, symptoms, causes_solutions, category, severity,
      products(sku, model, full_name)
    `)
    .eq('approved', true);
  
  if (productId) {
    query = query.eq('product_id', productId);
  }
  
  const { data: entries, error } = await query;
  
  if (error) throw error;
  
  // Score and rank results
  const scored = entries.map(entry => {
    let score = 0;
    const entryIssue = entry.issue?.toLowerCase() || '';
    const symptoms = entry.symptoms?.toLowerCase() || '';
    
    for (const word of issueWords) {
      if (entryIssue.includes(word)) score += 10;
      if (symptoms.includes(word)) score += 5;
    }
    
    // Exact match bonus
    if (entryIssue.includes(issue.toLowerCase())) score += 20;
    
    return { ...entry, score };
  });
  
  // Sort by score and take top results
  const topResults = scored
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  
  if (topResults.length === 0) {
    return `No troubleshooting entries found for "${issue}". Please describe the issue differently or contact Sonance support at (949) 492-7777.`;
  }
  
  // Format response for voice
  let response = '';
  
  if (productInfo) {
    response += `For the ${productInfo.model}:\n\n`;
  }
  
  topResults.forEach((entry, i) => {
    response += `Issue: ${entry.issue}\n`;
    if (entry.symptoms) response += `Symptoms: ${entry.symptoms}\n`;
    
    const solutions = entry.causes_solutions || [];
    solutions.forEach((cs, j) => {
      response += `\nCause ${j + 1}: ${cs.cause}\n`;
      response += `Solution: ${cs.solution}\n`;
    });
    response += '\n---\n';
  });
  
  response += `\nFor further assistance, contact Sonance support at (949) 492-7777.`;
  
  return response;
}
