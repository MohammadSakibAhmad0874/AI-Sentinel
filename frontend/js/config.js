/**
 * AI Sentinel — Frontend Config
 *
 * UPDATE the PROD_API_BASE below with your HuggingFace Space URL
 * after you create the Space on https://huggingface.co/spaces
 *
 * Format: https://<your-hf-username>-ai-sentinel.hf.space/api
 */

const PROD_API_BASE = 'https://MohammadSakibAhmad0874-ai-sentinel.hf.space/api';
const LOCAL_API_BASE = 'http://localhost:8000/api';

const IS_LOCAL = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
);

const API_BASE = IS_LOCAL ? LOCAL_API_BASE : PROD_API_BASE;

// Expose globally
window.SENTINEL_API_BASE = API_BASE;
