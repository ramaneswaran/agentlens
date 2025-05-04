import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip as PieTooltip, ResponsiveContainer as PieContainer,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import {
  loadCSVData,
  prepareToolMetrics,
  prepareDurationVsTokenData
} from '../utils/dataProcessing';
import { Button, Tabs, Tab } from 'react-bootstrap';

const COLORS = ['#0088FE', '#FF6B6B'];

const ToolDetail = () => {
  const { toolName } = useParams();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [scatterData, setScatterData] = useState([]);
  const [barData, setBarData] = useState([]);

  useEffect(() => {
    loadCSVData('/agent_metrics.csv').then(data => {
      const detail = prepareToolMetrics(data, toolName);
      setMetrics(detail);

      const allScatterData = prepareDurationVsTokenData(data);
      const filteredScatterData = allScatterData.filter(d => d.tool === toolName);
      setScatterData(filteredScatterData);

      const steps = detail.stepMetrics || {};
      const barChartData = Object.entries(steps).map(([step, stat]) => ({
        step: `Step ${step}`,
        timePerToken: stat.avgTimePerToken,
      }));
      setBarData(barChartData);
    });
  }, [toolName]);

  if (!metrics) return <p className="p-4">Loading...</p>;

  const pieData = [
    { name: 'Prompt Tokens', value: metrics.tokenDistribution.prompt },
    { name: 'Completion Tokens', value: metrics.tokenDistribution.completion },
  ];

  return (
    <div className="p-4">
      <div className="d-flex align-items-center mb-3">
        <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>← Back</Button>
        <h4 className="ms-3 mb-0">{toolName}</h4>
      </div>

      <p>
        <strong>Executions:</strong> ~ &nbsp;
        <strong>Avg Duration:</strong> {metrics.avgDuration.toFixed(2)}s &nbsp;|&nbsp;
        <strong>Error Rate:</strong> {(metrics.overallErrorRate * 100).toFixed(1)}%
      </p>

      {/* Tabs */}
      <Tabs defaultActiveKey="overview" className="mt-4">
        <Tab eventKey="overview" title="Overview">
          {/* Pie Chart */}
          <div className="mt-4">
            <h6>Token Distribution</h6>
            <div style={{ width: 300, height: 200 }}>
              <PieContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <PieTooltip />
                </PieChart>
              </PieContainer>
            </div>
          </div>

          {/* Scatter Plot */}
          <div className="mt-5">
            <h6>Token Count vs Duration</h6>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid />
                  <XAxis type="number" dataKey="tokenCount" name="Token Count" />
                  <YAxis type="number" dataKey="duration" name="Duration (s)" />
                  <Tooltip />
                  <Legend />
                  <Scatter
                    name="Success"
                    data={scatterData.filter(d => !d.hasError)}
                    fill="#00C49F"
                  />
                  <Scatter
                    name="Error"
                    data={scatterData.filter(d => d.hasError)}
                    fill="#FF6B6B"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="mt-5">
            <h6>Time per Token by Step</h6>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="step" />
                  <YAxis />
                  <Tooltip formatter={(val) => `${val.toFixed(5)} ms`} />
                  <Legend />
                  <Bar dataKey="timePerToken" name="Time per Token (ms)" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Tab>

        <Tab eventKey="step" title="Step Analysis">
          <div className="mt-4">
            <p>📊 Step-level error and retry analysis coming soon.</p>
          </div>
        </Tab>

        <Tab eventKey="token" title="Token Analysis">
          <div className="mt-4">
            <p>📊 Token trends and efficiency charts coming soon.</p>
          </div>
        </Tab>

        <Tab eventKey="code" title="Code Example">
          <div className="mt-4">
            <pre style={{ background: '#f0f0f0', padding: '1rem', borderRadius: '5px' }}>
{`# Sample Code Example
response = agent.run("get_statement", inputs={"topic": "quantum computing"})
print(response)`}
            </pre>
          </div>
        </Tab>
      </Tabs>
    </div>
  );
};

export default ToolDetail;
