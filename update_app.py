import re

with open("src/App.jsx", "r") as f:
    content = f.read()

# 1. Replace Zabbix with Prometheus
content = content.replace("Zabbix", "Prometheus")
content = content.replace("zabbix", "prometheus")

# 2. Add topologyTab state
content = re.sub(
    r'(const \[activeClusterId, setActiveClusterId\] = useState\([^)]+\);)',
    r'\1\n  const [topologyTab, setTopologyTab] = useState("architecture");',
    content
)

# 3. Modify the UI
topology_header = """                <h2 className="text-sm font-black text-slate-950">Recovery Flow Topology</h2>
                <p className="text-xs font-medium text-slate-500">
                  {activeCluster.provider} · {activeCluster.region} · selected cluster topology
                </p>"""

new_topology_header = """                <div className="flex gap-4">
                  <button 
                    onClick={() => setTopologyTab("architecture")}
                    className={`text-sm font-black pb-1 border-b-2 ${topologyTab === "architecture" ? "border-indigo-600 text-slate-950" : "border-transparent text-slate-400"}`}
                  >
                    Architecture Flow
                  </button>
                  <button 
                    onClick={() => setTopologyTab("user-cluster")}
                    className={`text-sm font-black pb-1 border-b-2 ${topologyTab === "user-cluster" ? "border-indigo-600 text-slate-950" : "border-transparent text-slate-400"}`}
                  >
                    User Cluster Map
                  </button>
                </div>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  {activeCluster.provider} · {activeCluster.region} · {topologyTab === "architecture" ? "Architecture workflow" : "Live cluster topology"}
                </p>"""

content = content.replace(topology_header, new_topology_header)

# 4. Generate user topology dynamically from apiResults.cloudTopology
# We need to build dynamic nodes and edges for the user cluster map.
react_flow_code = """              <ReactFlow
                key={activeCluster.id}
                nodes={activeNodes}
                edges={activeEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.22, minZoom: 0.25, maxZoom: 0.95 }}
                minZoom={0.25}
                maxZoom={1.45}
                nodesDraggable={false}
                nodesConnectable={false}
              >"""

new_react_flow_code = """              {topologyTab === "architecture" ? (
              <ReactFlow
                key={activeCluster.id}
                nodes={activeNodes}
                edges={activeEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.22, minZoom: 0.25, maxZoom: 0.95 }}
                minZoom={0.25}
                maxZoom={1.45}
                nodesDraggable={false}
                nodesConnectable={false}
              >
                <Background color="#94a3b8" gap={18} size={1.25} variant="dots" />
                <Controls showInteractive={false} />
              </ReactFlow>
              ) : (
                <UserClusterTopology apiResults={apiResults} />
              )}
"""

content = content.replace(react_flow_code + """
                <Background color="#94a3b8" gap={18} size={1.25} variant="dots" />
                <Controls showInteractive={false} />
              </ReactFlow>""", new_react_flow_code)

# Add UserClusterTopology component
user_cluster_component = """
function UserClusterTopology({ apiResults }) {
  const topology = getApiResult(apiResults, "cloudTopology");
  
  const nodes = useMemo(() => {
    if (!topology || !topology.nodes) return [];
    return topology.nodes.map((n, i) => ({
      id: n.id,
      type: "drNode",
      position: { x: 100 + (i * 400), y: 200 },
      data: {
        icon: n.type === "cloud-k8s" ? "cloud" : "edge",
        label: n.label || n.id,
        subtitle: n.type,
        status: "safe",
        detail: "Live agent connection",
        metrics: [
          ["IP", n.nodeIp || "N/A"],
          ["Node", n.nodeName || "N/A"],
        ],
      }
    }));
  }, [topology]);

  const edges = useMemo(() => {
    if (!topology || !topology.edges) return [];
    return topology.edges.map((e, i) => ({
      id: `edge-${i}`,
      source: e.source,
      target: e.target,
      type: "labeled",
      animated: true,
      label: e.relationship,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
      style: { stroke: "#64748b", strokeWidth: 2 },
      data: { labelOffset: { x: 0, y: -20 }, labelTone: "neutral" },
    }));
  }, [topology]);

  if (!topology || !topology.nodes) {
    return <div className="flex h-full items-center justify-center text-sm font-medium text-slate-500">No live topology data available</div>;
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      nodesDraggable={false}
      nodesConnectable={false}
    >
      <Background color="#94a3b8" gap={18} size={1.25} variant="dots" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
"""

content = content + user_cluster_component

with open("src/App.jsx", "w") as f:
    f.write(content)
