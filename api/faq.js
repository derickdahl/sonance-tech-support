// Vercel Serverless Function - FAQ lookup
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

let products = {};

function loadProducts() {
  if (Object.keys(products).length > 0) return products;
  const productsDir = join(process.cwd(), 'products');
  try {
    const skus = readdirSync(productsDir);
    for (const sku of skus) {
      const knowledgePath = join(productsDir, sku, 'knowledge.json');
      try {
        products[sku] = JSON.parse(readFileSync(knowledgePath, 'utf-8'));
      } catch (e) {}
    }
  } catch (e) {}
  return products;
}

function findProduct(query) {
  const prods = loadProducts();
  const q = query.toLowerCase().trim();
  if (prods[q]) return prods[q];
  for (const [sku, data] of Object.entries(prods)) {
    const model = data.product?.model?.toLowerCase() || '';
    if (model.includes(q) || q.includes(model)) return data;
  }
  return null;
}

function searchFAQ(product, question) {
  const faqs = product.faq || [];
  const q = question.toLowerCase();
  
  const scored = faqs.map(f => {
    let score = 0;
    const qText = f.question?.toLowerCase() || '';
    const aText = f.answer?.toLowerCase() || '';
    
    const keywords = q.split(/\s+/).filter(k => k.length >= 3);
    for (const kw of keywords) {
      if (qText.includes(kw)) score += 10;
      if (aText.includes(kw)) score += 3;
    }
    return { ...f, score };
  });
  
  return scored.filter(f => f.score > 0).sort((a, b) => b.score - a.score);
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { sku, model, question, q } = req.method === 'POST' ? req.body : req.query;
  const productQuery = sku || model;
  const questionQuery = question || q;
  
  if (!productQuery) {
    return res.status(400).json({ error: 'Missing sku or model parameter' });
  }
  
  const product = findProduct(productQuery);
  if (!product) {
    return res.status(404).json({ error: 'Product not found', query: productQuery });
  }
  
  if (!questionQuery) {
    return res.json({
      product: product.product?.model,
      faq: product.faq || []
    });
  }
  
  const results = searchFAQ(product, questionQuery);
  
  return res.json({
    product: product.product?.model,
    question: questionQuery,
    answers: results.length > 0 ? results : product.faq,
    matched: results.length > 0
  });
}
