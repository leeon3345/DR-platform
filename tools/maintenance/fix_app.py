import re

with open("src/App.jsx", "r") as f:
    content = f.read()

# 1. We need to replace the <ReactFlow ...> </ReactFlow> block inside Dashboard with the conditional logic.
# The block starts at <ReactFlow and ends at </ReactFlow>

react_flow_regex = re.compile(r'(<ReactFlow\s+key=\{activeCluster\.id\}.*?</ReactFlow>)', re.DOTALL)

match = react_flow_regex.search(content)
if match:
    original_flow = match.group(1)
    new_flow = f"""{{topologyTab === "architecture" ? (
              {original_flow}
            ) : (
              <UserClusterTopology apiResults={{apiResults}} nodeTypes={{nodeTypes}} edgeTypes={{edgeTypes}} />
            )}}"""
    content = content.replace(original_flow, new_flow)
    print("Replaced ReactFlow block successfully.")
else:
    print("Failed to find ReactFlow block.")

# 2. Fix the ReferenceError in UserClusterTopology by adding the props.
# I added UserClusterTopology at the bottom of the file earlier.
content = content.replace("function UserClusterTopology({ apiResults }) {", "function UserClusterTopology({ apiResults, nodeTypes, edgeTypes }) {")

with open("src/App.jsx", "w") as f:
    f.write(content)
