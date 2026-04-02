import React, { useState } from 'react';
import { Download, ChevronRight, ChevronDown, FileJson, Table as TableIcon, Network } from 'lucide-react';

interface ResultsProps {
  data: any;
}

export function Results({ data }: ResultsProps) {
  const [activeTab, setActiveTab] = useState<'mindmap' | 'table' | 'json'>('mindmap');

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => setActiveTab('mindmap')}
          className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'mindmap' ? 'bg-white border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Network className="w-4 h-4" />
          Mind Map
        </button>
        <button
          onClick={() => setActiveTab('table')}
          className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'table' ? 'bg-white border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <TableIcon className="w-4 h-4" />
          Summary Table
        </button>
        <button
          onClick={() => setActiveTab('json')}
          className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'json' ? 'bg-white border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileJson className="w-4 h-4" />
          JSON Export
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'mindmap' && <MindMap data={data} />}
        {activeTab === 'table' && <SummaryTable data={data} />}
        {activeTab === 'json' && <JsonExport data={data} />}
      </div>
    </div>
  );
}

function MindMap({ data }: { data: any }) {
  if (!data || !data.channels) return <div>No data available</div>;

  return (
    <div className="font-mono text-sm overflow-x-auto">
      <div className="font-bold text-lg mb-2 text-gray-800">{data.bank || 'UNKNOWN_BANK'}</div>
      {data.channels.map((channel: any, i: number) => (
        <div key={i} className="ml-4">
          <div className="flex items-center text-blue-700 font-semibold mt-2">
            <span className="mr-2 text-gray-400">{i === data.channels.length - 1 ? '└──' : '├──'}</span>
            {channel.channel} ({channel.total_rows || 0} rows)
          </div>
          <div className="ml-8 border-l-2 border-gray-100 pl-4 py-1">
            {channel.patterns?.map((pattern: any, j: number) => (
              <div key={j} className="mb-4 last:mb-0">
                <div className="font-medium text-gray-700">
                  <span className="mr-2 text-gray-400">{j === channel.patterns.length - 1 ? '└──' : '├──'}</span>
                  Pattern {j + 1}: "{pattern.template}" — {pattern.row_count || 0} rows
                </div>
                <div className="ml-8 text-gray-600 space-y-1 mt-1">
                  <div><span className="text-gray-400">Raw:</span> "{pattern.example_raw}"</div>
                  {pattern.segments?.map((seg: any, k: number) => (
                    <div key={k} className="text-green-700">
                      segment[{seg.position}] → {seg.maps_to} {seg.value ? `("${seg.value}")` : ''}
                    </div>
                  ))}
                  <div><span className="text-gray-400">Regex:</span> <span className="text-purple-600">{pattern.regex}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryTable({ data }: { data: any }) {
  if (!data || !data.channels) return <div>No data available</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="py-3 px-4 font-semibold text-gray-700">Channel</th>
            <th className="py-3 px-4 font-semibold text-gray-700">Patterns</th>
            <th className="py-3 px-4 font-semibold text-gray-700">Matched</th>
            <th className="py-3 px-4 font-semibold text-gray-700">Unmatched</th>
            <th className="py-3 px-4 font-semibold text-gray-700">Coverage</th>
          </tr>
        </thead>
        <tbody>
          {data.channels.map((channel: any, i: number) => {
            const matched = channel.total_rows || 0;
            // We don't have unmatched per channel easily from the LLM, so we just show matched.
            return (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 font-medium text-gray-800">{channel.channel}</td>
                <td className="py-3 px-4 text-gray-600">{channel.patterns?.length || 0}</td>
                <td className="py-3 px-4 text-gray-600">{matched}</td>
                <td className="py-3 px-4 text-gray-400">-</td>
                <td className="py-3 px-4 text-gray-600">
                  {data.total_rows ? ((matched / data.total_rows) * 100).toFixed(1) + '%' : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-50 font-semibold border-t-2 border-gray-200">
          <tr>
            <td className="py-3 px-4">Total</td>
            <td className="py-3 px-4">{data.channels.reduce((acc: number, c: any) => acc + (c.patterns?.length || 0), 0)}</td>
            <td className="py-3 px-4">{data.total_rows - (data.unmatched_rows || 0)}</td>
            <td className="py-3 px-4">{data.unmatched_rows || 0}</td>
            <td className="py-3 px-4 text-blue-600">{data.coverage_pct || '0%'}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function JsonExport({ data }: { data: any }) {
  const jsonString = JSON.stringify(data, null, 2);

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.bank || 'analysis'}_patterns.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-800">JSON Output</h3>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          Download JSON
        </button>
      </div>
      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
        <pre className="text-green-400 font-mono text-sm">
          <code>{jsonString}</code>
        </pre>
      </div>
    </div>
  );
}
