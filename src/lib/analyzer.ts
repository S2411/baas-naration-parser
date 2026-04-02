import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeStatement(data: any[], bankName: string, onProgress: (msg: string) => void) {
  onProgress('Identifying columns...');
  
  if (data.length === 0) throw new Error("File is empty");
  
  const headers = Object.keys(data[0]);
  
  // Find narration column
  const narrationKeywords = ['narration', 'particulars', 'description', 'transaction particulars', 'remarks'];
  let narrationCol = headers.find(h => narrationKeywords.some(k => h.toLowerCase().includes(k)));
  
  if (!narrationCol) {
    narrationCol = headers.find(h => typeof data[0][h] === 'string' && data[0][h].length > 10) || headers[0];
  }

  onProgress('Scanning narrations and sampling patterns...');
  
  // Extract all narrations
  const narrations = data.map(row => String(row[narrationCol] || '')).filter(n => n.trim() !== '');
  
  // Group by prefix and structure to sample
  const samples: string[] = [];
  const patternMap = new Map<string, string[]>();
  
  for (const narration of narrations) {
    const upperNarration = narration.toUpperCase();
    
    // Find known keywords in the narration to help group
    const keywords = ['CASH', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'SWIFT', 'NACH', 'CHQ', 'CHEQUE', 'DD', 'POS', 'INTERNAL', 'TRANSFER', 'FOREX', 'INB', 'MB', 'ACH', 'ECS', 'PUR', 'SWIPE', 'CLG'];
    const foundKeyword = keywords.find(k => upperNarration.includes(k)) || 'OTHER';
    
    // Determine structure (number of delimiters)
    const delimiters = Array.from(new Set(narration.match(/[/\-:]/g) || [])).sort().join('');
    const structureKey = `${foundKeyword}_${delimiters}`;
    
    if (!patternMap.has(structureKey)) {
      patternMap.set(structureKey, []);
    }
    
    const group = patternMap.get(structureKey)!;
    if (group.length < 5) { // Sample up to 5 per pattern
      group.push(narration);
      samples.push(narration);
    }
  }

  onProgress('Analyzing patterns with AI...');

  const prompt = `
You are a bank statement narration analyser for BAAS (Bank Account Analysis System), a forensic tool used in PMLA investigations by the Directorate of Enforcement, India.

Bank Name: ${bankName}
Total Rows: ${data.length}
Columns Found: ${headers.join(', ')}
Identified Narration Column: ${narrationCol}

I have sampled the narrations to minimize tokens. Here are representative samples of the patterns found in the file:
${samples.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Based on these samples and the column headers, perform the analysis as requested.

== STEP 1: FILE ANALYSIS ==
1. Read column headers. Identify:
   - Narration column
   - Debit and Credit columns
   - Account metadata columns if present (Account Number, Account Holder, IFSC)
2. Report: total rows, columns found, metadata source (columns/headers/none)

== STEP 2: NARRATION SCAN ==
3. Read ALL narrations (use the samples provided as representative of the whole).
4. Classify each pattern into one of 14 payment_channel values:
   CASH, NEFT, RTGS, IMPS, UPI, SWIFT, NACH, CHQ, DD, POS,
   INTERNAL, FUND_TRANSFER, FOREX, OTHER
   *CRITICAL*: The channel might not be the first word. Look for keywords anywhere in the narration.
   - "BY CASH" or "CASH DEP" -> CASH
   - "TO TRANSFER" or "INB" -> FUND_TRANSFER
   - "UPI/" or "@upi" or "@ybl" -> UPI
   - "NEFT" -> NEFT
   - "RTGS" -> RTGS
   - "IMPS" -> IMPS
   - "CHQ" or "CHEQUE" or "CLG" -> CHQ
   - "ACH" or "NACH" or "ECS" -> NACH
   - "POS" or "PUR" or "SWIPE" -> POS

== STEP 3: PATTERN IDENTIFICATION ==
6. For each payment_channel category:
   a. Identify distinct narration PATTERNS.
   b. A "pattern" = a consistent delimiter-separated structure
   c. For each pattern, show:
      - Template: e.g., "NEFT/{UTR}/{SENDER_NAME}/{SENDER_IFSC}"
      - Delimiter used (/ or - or : or space or none)
      - One raw example narration
      - Which segment maps to which database column:
        * cp_name_raw (counterparty name)
        * cp_account (counterparty bank account number)
        * cp_ifsc (IFSC code, 11 chars starting with 4 uppercase letters)
        * reference_number (UTR or transaction reference)
        * cp_upi_id (UPI VPA — contains @)
        * cheque_number (instrument number)
        * purpose_hint (salary/rent/emi etc)
      - Suggested regex for extraction

== STEP 4: OUTPUT FORMAT ==
Output the complete analysis as a JSON object with this structure:
{
  "bank": "BANK_NAME",
  "total_rows": N,
  "columns_found": ["col1", "col2"],
  "metadata_source": "columns/headers/none",
  "channels": [
    {
      "channel": "NEFT",
      "patterns": [
        {
          "pattern_id": "NEFT_P1",
          "template": "NEFT/{UTR}/{SENDER}/{IFSC}",
          "delimiter": "/",
          "segments": [
            {"position": 0, "value": "NEFT", "maps_to": "payment_channel"},
            {"position": 1, "maps_to": "reference_number"},
            {"position": 2, "maps_to": "cp_name_raw"},
            {"position": 3, "maps_to": "cp_ifsc"}
          ],
          "example_raw": "NEFT/SBIN724031201/RAHUL SHARMA/SBIN0070682",
          "regex": "^NEFT/([A-Z0-9]+)/(.+?)/([A-Z]{4}\\\\d{7})$"
        }
      ]
    }
  ]
}

== RULES ==
- Do NOT guess patterns. Only document what you actually see in the data.
- Every regex must be tested against the real narrations provided.
- If a narration doesn't match any pattern, classify as OTHER.
- Counterparty name is NEVER: the bank name, a reference number, a date, or a transaction type keyword.
- Account numbers are 9-18 digit numeric strings.
- IFSC codes are exactly 11 characters: 4 uppercase letters + 0 + 6 alphanumeric.
- UTR/reference numbers are 12-22 character alphanumeric strings.
- UPI VPAs always contain @ (e.g., name@ybl, 9876543210@paytm).
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          bank: { type: Type.STRING },
          total_rows: { type: Type.INTEGER },
          columns_found: { type: Type.ARRAY, items: { type: Type.STRING } },
          metadata_source: { type: Type.STRING },
          channels: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                channel: { type: Type.STRING },
                patterns: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      pattern_id: { type: Type.STRING },
                      template: { type: Type.STRING },
                      delimiter: { type: Type.STRING },
                      segments: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            position: { type: Type.INTEGER },
                            value: { type: Type.STRING },
                            maps_to: { type: Type.STRING }
                          }
                        }
                      },
                      example_raw: { type: Type.STRING },
                      regex: { type: Type.STRING }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  const jsonResult = JSON.parse(response.text || '{}');
  
  // Post-process to calculate row counts for each pattern locally
  onProgress('Calculating row counts...');
  
  let matchedRows = 0;
  
  for (const channel of jsonResult.channels || []) {
    let channelRows = 0;
    for (const pattern of channel.patterns || []) {
      let count = 0;
      try {
        const regex = new RegExp(pattern.regex);
        for (const narration of narrations) {
          if (regex.test(narration)) {
            count++;
          }
        }
      } catch (e) {
        console.error("Invalid regex generated:", pattern.regex);
      }
      pattern.row_count = count;
      channelRows += count;
      matchedRows += count;
    }
    channel.total_rows = channelRows;
  }
  
  jsonResult.unmatched_rows = narrations.length - matchedRows;
  jsonResult.coverage_pct = narrations.length > 0 ? ((matchedRows / narrations.length) * 100).toFixed(2) + '%' : '0%';
  jsonResult.total_rows = data.length;

  return jsonResult;
}
