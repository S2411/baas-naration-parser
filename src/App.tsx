import React, { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { parseFile } from './lib/fileParser';
import { analyzeStatement } from './lib/analyzer';
import { Results } from './components/Results';

const INDIAN_BANKS = [
  "Axis Bank", "Bandhan Bank", "Bank of Baroda", "Bank of India", "Bank of Maharashtra",
  "Canara Bank", "Central Bank of India", "Citi Bank", "City Union Bank", "DBS Bank India",
  "Federal Bank", "HDFC Bank", "HSBC", "ICICI Bank", "IDFC First Bank", "Indian Bank",
  "Indian Overseas Bank", "IndusInd Bank", "Karur Vysya Bank", "Kotak Mahindra Bank",
  "Punjab & Sind Bank", "Punjab National Bank (PNB)", "RBL Bank", "South Indian Bank",
  "Standard Chartered Bank", "State Bank of India (SBI)", "UCO Bank", "Union Bank of India",
  "Yes Bank", "Other"
];

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [bankName, setBankName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any | null>(null);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f: File) => 
      f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
      setError(null);
    } else {
      setError('Please upload valid CSV or Excel files.');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter((f: File) => 
      f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles]);
      setError(null);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      setError('Please select at least one file.');
      return;
    }
    if (!bankName.trim()) {
      setError('Please select a bank name.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResults(null);

    try {
      setProgressMsg('Parsing files...');
      let allData: any[] = [];
      for (const f of files) {
        const data = await parseFile(f);
        allData = allData.concat(data);
      }
      
      const result = await analyzeStatement(allData, bankName, setProgressMsg);
      setResults(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during analysis.');
    } finally {
      setIsAnalyzing(false);
      setProgressMsg('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-200">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <FileText className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">BAAS Narration Analyser</h1>
            <p className="text-xs text-gray-500 font-medium">Directorate of Enforcement, India</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {!results && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="max-w-xl mx-auto space-y-8">
              
              <div className="space-y-2">
                <label htmlFor="bankName" className="block text-sm font-semibold text-gray-700">
                  Bank Name
                </label>
                <select
                  id="bankName"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                >
                  <option value="">Select a bank...</option>
                  {INDIAN_BANKS.map(bank => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Statement Files (CSV/Excel)
                </label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    files.length > 0 ? 'border-blue-400 bg-blue-50/50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  <input
                    type="file"
                    id="fileUpload"
                    accept=".csv,.xlsx,.xls"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <label htmlFor="fileUpload" className="cursor-pointer flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                      <Upload className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-500 mt-1">CSV, XLSX, XLS up to 50MB (Multiple allowed)</p>
                    </div>
                  </label>
                </div>
                
                {files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                          <span className="text-sm font-medium text-gray-700 truncate">{f.name}</span>
                        </div>
                        <button onClick={() => removeFile(i)} className="p-1 hover:bg-gray-100 rounded-md text-gray-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || files.length === 0 || !bankName.trim()}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {progressMsg || 'Analyzing...'}
                  </>
                ) : (
                  'Analyze Statement'
                )}
              </button>
            </div>
          </div>
        )}

        {results && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Analysis Results</h2>
              <button
                onClick={() => {
                  setResults(null);
                  setFiles([]);
                  setBankName('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Analyze Another File
              </button>
            </div>

            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-sm text-gray-500 font-medium mb-1">Total Rows</div>
                <div className="text-2xl font-bold text-gray-900">{results.total_rows}</div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-sm text-gray-500 font-medium mb-1">Matched Rows</div>
                <div className="text-2xl font-bold text-green-600">{results.total_rows - (results.unmatched_rows || 0)}</div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-sm text-gray-500 font-medium mb-1">Unmatched Rows</div>
                <div className="text-2xl font-bold text-orange-500">{results.unmatched_rows || 0}</div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-sm text-gray-500 font-medium mb-1">Coverage</div>
                <div className="text-2xl font-bold text-blue-600">{results.coverage_pct || '0%'}</div>
              </div>
            </div>

            <Results data={results} />
          </div>
        )}
      </main>
    </div>
  );
}
