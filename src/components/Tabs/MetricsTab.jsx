import React, { useEffect, useState } from 'react';
import {
  loadCSVData,
  extractUniqueTools,
  prepareErrorByStepData,
  prepareDurationVsTokenData,
  prepareRuntimeDistributionData,
  prepareToolMetrics
} from '../../utils/dataProcessing';
import { Button, Form, Badge } from 'react-bootstrap';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter,
  BarChart, Bar,
  ComposedChart
} from 'recharts';

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#00C49F',
  '#FF6B6B', '#FFBB28', '#A28EFF', '#FF9F9F', '#00B2CA'
];

const MetricsTab = () => {
  const [data, setData] = useState([]);
  const [availableTools, setAvailableTools] = useState([]);
  const [selectedTools, setSelectedTools] = useState([]);
  const [errorData, setErrorData] = useState([]);
  const [scatterData, setScatterData] = useState([]);
  const [runtimeData, setRuntimeData] = useState([]);
  const [tokenMetrics, setTokenMetrics] = useState([]);

  useEffect(() => {
    loadCSVData('/agent_metrics.csv').then(parsed => {
      const tools = extractUniqueTools(parsed);
      setData(parsed);
      setAvailableTools(tools);
      setSelectedTools(tools); // ✅ select all tools by default
    });
  }, []);

  useEffect(() => {
    if (data.length && selectedTools.length) {
      const errData = prepareErrorByStepData(data).map(row => {
        const filtered = { step: row.step };
        selectedTools.forEach(tool => {
          filtered[tool] = row[tool] || 0;
        });
        return filtered;
      });
      setErrorData(errData);

      const scatter = prepareDurationVsTokenData(data).filter(d =>
        selectedTools.includes(d.tool)
      );
      setScatterData(scatter);

      const runtime = prepareRuntimeDistributionData(data).filter(d =>
        selectedTools.includes(d.tool)
      );
      setRuntimeData(runtime);

      const tokens = selectedTools.map(tool => {
        const detail = prepareToolMetrics(data, tool);
        return {
          tool,
          totalTokens: detail.avgTokens,
          prompt: detail.tokenDistribution.prompt,
          completion: detail.tokenDistribution.completion,
          timePerToken: Object.values(detail.stepMetrics).reduce((acc, val) => acc + val.avgTimePerToken, 0) / Object.keys(detail.stepMetrics).length
        };
      });
      setTokenMetrics(tokens);
    }
  }, [data, selectedTools]);

  const handleAddTool = (e) => {
    const tool = e.target.value;
    if (tool && !selectedTools.includes(tool)) {
      setSelectedTools([...selectedTools, tool]);
    }
  };

  const removeTool = (toolToRemove) => {
    setSelectedTools(selectedTools.filter(t => t !== toolToRemove));
  };

  return (
    <div className="p-4">
      <h5>Tool Selection</h5>
      <Form.Select onChange={handleAddTool} value="">
        <option value="">Select tool...</option>
        {availableTools.map(tool => (
          <option key={tool} value={tool}>{tool}</option>
        ))}
      </Form.Select>

      <div className="mt-3 mb-4">
        {selectedTools.map((tool, idx) => (
          <Badge
            key={tool}
            bg="secondary"
            className="me-2 mb-2"
            style={{ fontSize: '1rem', padding: '0.5rem 0.75rem' }}
          >
            {tool}
            <Button
              size="sm"
              variant="light"
              onClick={() => removeTool(tool)}
              className="ms-2 py-0 px-2"
            >
              ✕
            </Button>
          </Badge>
        ))}
      </div>

      {/* Chart 1: Error Count by Step */}
      {errorData.length > 0 && (
        <>
          <h6>Error Count by Step</h6>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={errorData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="step" />
                <YAxis />
                <Tooltip />
                <Legend />
                {selectedTools.map((tool, idx) => (
                  <Line
                    key={tool}
                    type="monotone"
                    dataKey={tool}
                    stroke={COLORS[idx % COLORS.length]}
                    dot={{ r: 2 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Chart 2: Duration vs Token Count */}
      {scatterData.length > 0 && (
        <>
          <h6 className="mt-5">Duration vs Token Count</h6>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid />
                <XAxis type="number" dataKey="tokenCount" name="Token Count" />
                <YAxis type="number" dataKey="duration" name="Duration (s)" />
                <Tooltip />
                <Legend />
                {selectedTools.map((tool, idx) => (
                  <Scatter
                    key={tool}
                    name={tool}
                    data={scatterData.filter(d => d.tool === tool)}
                    fill={COLORS[idx % COLORS.length]}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Chart 3: Runtime Distribution */}
      {runtimeData.length > 0 && (
        <>
          <h6 className="mt-5">Runtime Distribution (Success vs Error)</h6>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={runtimeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="tool" type="category" />
                <Tooltip />
                <Legend />
                <Bar dataKey="success.avg" fill="#00C49F" name="Success" />
                <Bar dataKey="error.avg" fill="#FF6B6B" name="Error" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Chart 4: Token Metrics by Tool */}
      {tokenMetrics.length > 0 && (
        <>
          <h6 className="mt-5">Token Metrics by Tool</h6>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <ComposedChart data={tokenMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tool" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="totalTokens" name="Avg Total Tokens" fill="#3399FF" />
                <Bar yAxisId="left" dataKey="prompt" name="Avg Prompt Tokens" fill="#FF4444" />
                <Bar yAxisId="left" dataKey="completion" name="Avg Completion Tokens" fill="#FFA500" />
                <Line yAxisId="right" type="monotone" dataKey="timePerToken" stroke="#00C49F" name="Time per Token (ms)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};

export default MetricsTab;
