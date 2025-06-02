import React, { useState, useEffect, useRef } from "react";
import cytoscape from "cytoscape";

// Botão estilizado (você já usava esse)
const Button = ({ children, ...props }) => (
  <button
    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-all"
    {...props}
  >
    {children}
  </button>
);

const Card = ({ children }) => <div className="card">{children}</div>;

const CardContent = ({ children }) => <div>{children}</div>;

export default function GraphApp() {
  const cyRef = useRef(null);
  const containerRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [adjMatrix, setAdjMatrix] = useState([]);
  const [matrixInput, setMatrixInput] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [routesOutput, setRoutesOutput] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [filename, setFilename] = useState("grafo");
  const [isDirected, setIsDirected] = useState(true);

  // Inicialização do Cytoscape
  useEffect(() => {
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: [],
      style: [
        {
          selector: "node",
          style: {
            content: "data(label)",
            "text-valign": "center",
            "background-color": "#007bff",
            color: "#fff",
            width: 40,
            height: 40,
          },
        },
        {
          selector: "edge",
          style: {
            label: "data(weight)",
            "curve-style": "bezier",
            "target-arrow-shape": isDirected ? "triangle" : "none",
            "line-color": "#aaa",
            "target-arrow-color": "#aaa",
            "arrow-scale": 1.5,
          },
        },
      ],
      layout: { name: "grid" },
    });

    // Clique no background para adicionar nó
    cyRef.current.on("tap", (event) => {
      if (event.target === cyRef.current) {
        const id = `n${nodes.length}`;
        const newNode = { data: { id, label: id }, position: event.position };
        setNodes((prev) => [...prev, newNode]);
        cyRef.current.add(newNode);
      }
    });

    // Clique em nó para seleção e criação de aresta
    cyRef.current.on("tap", "node", (event) => {
      const selected = event.target.id();
      if (selectedNode && selectedNode !== selected) {
        const source = selectedNode;
        const target = selected;
        const weight = prompt("Peso da aresta:", "1");
        if (weight !== null && !isNaN(weight) && weight.trim() !== "") {
          const edgeId = isDirected
            ? `${source}->${target}`
            : [source, target].sort().join("--");
          // Evitar arestas duplicadas em grafos não direcionados
          const edgeExists = edges.some((e) => e.data.id === edgeId);
          if (!edgeExists) {
            const newEdge = {
              data: { id: edgeId, source, target, weight: parseInt(weight) },
            };
            setEdges((prev) => [...prev, newEdge]);
            cyRef.current.add(newEdge);
          } else {
            alert("Aresta já existe!");
          }
        }
        setSelectedNode(null);
      } else {
        setSelectedNode(selected);
      }
    });

    // Atualizar grafo ao mudar nodes ou edges
    cyRef.current.add([...nodes, ...edges]);
    cyRef.current.layout({ name: "grid" }).run();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, isDirected]);

  // Gera matriz de adjacência a partir do grafo atual
  const generateAdjMatrix = () => {
    const size = nodes.length;
    const matrix = Array(size)
      .fill(0)
      .map(() => Array(size).fill(0));

    edges.forEach(({ data: { source, target, weight } }) => {
      const i = nodes.findIndex((n) => n.data.id === source);
      const j = nodes.findIndex((n) => n.data.id === target);
      matrix[i][j] = parseInt(weight);
      if (!isDirected) {
        matrix[j][i] = parseInt(weight);
      }
    });

    setAdjMatrix(matrix);
  };

  // Desenha grafo a partir da matriz de adjacência informada
  const drawFromMatrix = () => {
    const lines = matrixInput.trim().split("\n");
    const matrix = lines.map((line) => line.trim().split(/\s+/).map(Number));
    setAdjMatrix(matrix);

    cyRef.current.elements().remove();

    const newNodes = matrix.map((_, i) => ({
      data: { id: `n${i}`, label: `n${i}` },
    }));

    const newEdges = [];
    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix[i].length; j++) {
        if (matrix[i][j] > 0) {
          if (isDirected || i <= j) {
            newEdges.push({
              data: {
                id: isDirected ? `n${i}->n${j}` : `n${i}--n${j}`,
                source: `n${i}`,
                target: `n${j}`,
                weight: matrix[i][j],
              },
            });
          }
        }
      }
    }

    setNodes(newNodes);
    setEdges(newEdges);
    cyRef.current.add([...newNodes, ...newEdges]);
    cyRef.current.layout({ name: "grid" }).run();
  };

  // Busca todas rotas possíveis entre origem e destino
  const findAllPaths = (
    start,
    end,
    visited = new Set(),
    path = [],
    allPaths = []
  ) => {
    visited.add(start);
    path.push(start);

    if (start === end) {
      allPaths.push([...path]);
    } else {
      const neighbors = adjMatrix[start]
        .map((weight, index) => (weight > 0 ? index : -1))
        .filter((i) => i !== -1 && !visited.has(i));
      for (const neighbor of neighbors) {
        findAllPaths(neighbor, end, new Set(visited), [...path], allPaths);
      }
    }
    return allPaths;
  };

  // Calcula as rotas e apresenta custo e caminhos
  const calculateRoutes = () => {
    if (!origin || !destination) {
      setRoutesOutput("Informe origem e destino.");
      return;
    }
    const startIdx = parseInt(origin.replace("n", ""));
    const endIdx = parseInt(destination.replace("n", ""));
    if (
      isNaN(startIdx) ||
      isNaN(endIdx) ||
      startIdx < 0 ||
      endIdx < 0 ||
      startIdx >= adjMatrix.length ||
      endIdx >= adjMatrix.length
    ) {
      setRoutesOutput("Origem ou destino inválidos.");
      return;
    }
    const paths = findAllPaths(startIdx, endIdx);
    if (paths.length === 0) {
      setRoutesOutput("Nenhuma rota encontrada.");
      return;
    }
    const routeWithCost = paths.map((path) => {
      let cost = 0;
      for (let i = 0; i < path.length - 1; i++) {
        cost += adjMatrix[path[i]][path[i + 1]];
      }
      return { path: path.map((i) => `n${i}`), cost };
    });
    routeWithCost.sort((a, b) => a.cost - b.cost);
    const output = [
      "Todas as rotas:",
      ...routeWithCost.map((r) => `${r.path.join(" -> ")} (Custo: ${r.cost})`),
      `\nRota mais curta: ${routeWithCost[0].path.join(" -> ")} (Custo: ${
        routeWithCost[0].cost
      })`,
      `Rota mais longa: ${routeWithCost[routeWithCost.length - 1].path.join(
        " -> "
      )} (Custo: ${routeWithCost[routeWithCost.length - 1].cost})`,
    ].join("\n");
    setRoutesOutput(output);
  };

  // Exporta grafo para arquivo JSON
  const exportGraphToFile = () => {
    const data = {
      nodes,
      edges,
      directed: isDirected,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename || "grafo"}.json`;
    link.click();
  };
  const handleImportGraph = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const loadedNodes = data.nodes || [];
        const loadedEdges = data.edges || [];

        // Limpa o grafo atual
        cyRef.current.elements().remove();

        // Atualiza os estados
        setNodes(loadedNodes);
        setEdges(loadedEdges);

        // Adiciona os elementos no Cytoscape
        cyRef.current.add([...loadedNodes, ...loadedEdges]);
        cyRef.current.layout({ name: "grid" }).run();
      } catch (error) {
        alert("Erro ao importar o grafo.");
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="App grid-container">
      <Card>
        <CardContent>
          <div
            className="h-[500px] border rounded-lg"
            ref={containerRef}
            style={{ width: "100%", height: "500px" }}
          ></div>
          <div className="my-3 flex items-center gap-3">
            <label>
              <input
                type="checkbox"
                checked={isDirected}
                onChange={() => setIsDirected(!isDirected)}
              />{" "}
              Grafo Direcionado
            </label>
          </div>
          <Button className="mt-4" onClick={generateAdjMatrix}>
            Gerar Matriz de Adjacência
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="card-header">Matriz de Adjacência</h2>
          <pre className="text-sm overflow-x-auto mb-2">
            {adjMatrix.length > 0
              ? adjMatrix.map((row) => row.join(" ")).join("\n")
              : "Matriz vazia"}
          </pre>
          <textarea
            className="w-full h-32 p-2 border rounded mb-2 text-sm"
            placeholder={`Insira a matriz manualmente\nEx:\n0 1 0\n1 0 1\n0 1 0\n(para ${
              isDirected ? "direcionado" : "não direcionado"
            })`}
            value={matrixInput}
            onChange={(e) => setMatrixInput(e.target.value)}
          />
          <Button onClick={drawFromMatrix}>Desenhar Grafo da Matriz</Button>

          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder="Origem (ex: n0)"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="border rounded p-1 text-sm"
            />
            <input
              type="text"
              placeholder="Destino (ex: n2)"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="border rounded p-1 text-sm"
            />
            <Button onClick={calculateRoutes}>Calcular Rotas</Button>
          </div>

          <pre className="text-sm whitespace-pre-wrap mt-2">{routesOutput}</pre>

          <input
            type="text"
            placeholder="Nome do arquivo (sem extensão)"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="border rounded p-1 mt-4 w-full text-sm"
          />
          <Button onClick={exportGraphToFile} className="mt-2">
            Salvar Grafo como JSON
          </Button>
          <input
            type="file"
            accept=".json"
            onChange={handleImportGraph}
            className="mt-2 text-sm"
          />
        </CardContent>
      </Card>
    </div>
  );
}
