// ============================================================
// Interval-graph algorithm (pure functions)
// ============================================================

/** Lexicographic BFS — returns a vertex ordering. */
function lexBFS(n, adj) {
    if (n === 0) return [];
    let partition = [new Set(Array.from({ length: n }, (_, i) => i))];
    const order = [];

    while (order.length < n) {
        while (partition.length > 0 && partition[0].size === 0) partition.shift();
        if (partition.length === 0) break;

        const v = partition[0].values().next().value;
        partition[0].delete(v);
        if (partition[0].size === 0) partition.shift();
        order.push(v);

        const next = [];
        for (const part of partition) {
            const inN = new Set(), outN = new Set();
            for (const u of part) (adj[v].has(u) ? inN : outN).add(u);
            if (inN.size > 0) next.push(inN);
            if (outN.size > 0) next.push(outN);
        }
        partition = next;
    }
    return order;
}

/**
 * Check whether `order` is a Perfect Elimination Ordering.
 * For each vertex v, its later-ordered neighbours must form a clique.
 */
function isPEO(n, adj, order) {
    const pos = new Array(n);
    order.forEach((v, i) => { pos[v] = i; });

    for (let i = 0; i < n; i++) {
        const v = order[i];
        const earlier = [...adj[v]].filter(u => pos[u] < i);
        for (let a = 0; a < earlier.length; a++) {
            for (let b = a + 1; b < earlier.length; b++) {
                if (!adj[earlier[a]].has(earlier[b])) return false;
            }
        }
    }
    return true;
}

/** Bron-Kerbosch with pivot — returns all maximal cliques as Sets. */
function findMaxCliques(n, adj) {
    const result = [];

    function bk(R, P, X) {
        if (P.size === 0 && X.size === 0) { result.push(new Set(R)); return; }
        const PX = [...P, ...X];
        let pivot = PX[0], pc = 0;
        for (const u of PX) {
            const cnt = [...P].filter(w => adj[u].has(w)).length;
            if (cnt > pc) { pc = cnt; pivot = u; }
        }
        for (const v of [...P].filter(w => !adj[pivot].has(w))) {
            bk(
                [...R, v],
                new Set([...P].filter(u => adj[v].has(u))),
                new Set([...X].filter(u => adj[v].has(u)))
            );
            P.delete(v); X.add(v);
        }
    }

    bk([], new Set(Array.from({ length: n }, (_, i) => i)), new Set());
    return result;
}

/**
 * Try to find a Hamiltonian path through the maximal cliques satisfying the
 * Consecutive Ones Property: for every vertex v, all cliques that contain v
 * must appear consecutively in the path.
 *
 * Returns an array of clique indices (the path order) or null if none exists.
 */
function findCliquePath(cliques, n) {
    const k = cliques.length;
    if (k === 0) return [];
    if (k === 1) return [0];

    // Build clique-intersection adjacency (two cliques are adjacent iff they share a vertex)
    const inter = Array.from({ length: k }, (_, i) =>
        Array.from({ length: k }, (_, j) =>
            i !== j && [...cliques[i]].some(v => cliques[j].has(v))
        )
    );

    // Map vertex → list of clique indices containing it
    const vCliques = Array.from({ length: n }, () => []);
    for (let ci = 0; ci < k; ci++) {
        for (const v of cliques[ci]) {
            if (v < n) vCliques[v].push(ci);
        }
    }

    const path = [];
    const used = new Array(k).fill(false);

    /** Check the partial path hasn't already violated the COP. */
    function pathValid() {
        for (let v = 0; v < n; v++) {
            if (vCliques[v].length < 2) continue;
            const placed = vCliques[v].filter(ci => used[ci]);
            if (placed.length < 2) continue;
            const positions = placed.map(ci => path.indexOf(ci)).sort((a, b) => a - b);
            for (let i = 0; i < positions.length - 1; i++) {
                for (let p = positions[i] + 1; p < positions[i + 1]; p++) {
                    if (!cliques[path[p]].has(v)) return false;
                }
            }
        }
        return true;
    }

    function bt() {
        if (path.length === k) return true;
        const last = path.length > 0 ? path[path.length - 1] : -1;
        for (let ci = 0; ci < k; ci++) {
            if (used[ci] || (last !== -1 && !inter[last][ci])) continue;
            path.push(ci); used[ci] = true;
            if (pathValid() && bt()) return true;
            path.pop(); used[ci] = false;
        }
        return false;
    }

    if (bt()) return path.slice();
    return null;
}

/** BFS-based connected components. Returns array of arrays (vertex indices). */
function findComponents(n, adj) {
    const visited = new Array(n).fill(false);
    const comps = [];
    for (let s = 0; s < n; s++) {
        if (visited[s]) continue;
        const comp = [], queue = [s];
        visited[s] = true;
        while (queue.length) {
            const v = queue.shift();
            comp.push(v);
            for (const u of adj[v]) if (!visited[u]) { visited[u] = true; queue.push(u); }
        }
        comps.push(comp);
    }
    return comps;
}

/**
 * Main check: is the graph (given as array of Sets) an interval graph?
 *
 * Returns { isInterval: true, intervals: [{start, end}, …] }  — one entry per vertex
 *      or { isInterval: false, reason: 'not_chordal'|'not_interval', component }
 */
function checkIntervalGraph(n, adj) {
    if (n === 0) return { isInterval: true, intervals: [] };

    const components = findComponents(n, adj);
    const rawIntervals = new Array(n).fill(null); // { lo, hi } in arbitrary units
    const GAP = 1;   // spacing units between disconnected components
    const SCALE = 2; // units per clique position step
    let offset = 0;

    for (const comp of components) {
        const m = comp.length;

        if (m === 1) {
            rawIntervals[comp[0]] = { lo: offset, hi: offset + SCALE };
            offset += SCALE + GAP;
            continue;
        }

        // Build subgraph
        const subIdx = new Map(comp.map((v, i) => [v, i]));
        const subAdj = comp.map(v =>
            new Set([...adj[v]].map(u => subIdx.get(u)).filter(u => u !== undefined))
        );

        const sigma = lexBFS(m, subAdj);
        if (!isPEO(m, subAdj, sigma)) {
            return { isInterval: false, reason: 'not_chordal', component: comp };
        }

        const cliques = findMaxCliques(m, subAdj);
        const pathOrder = findCliquePath(cliques, m);
        if (!pathOrder) {
            return { isInterval: false, reason: 'not_interval', component: comp };
        }

        // Each vertex's interval = [first clique index in path, last clique index + 1]
        for (let i = 0; i < m; i++) {
            let lo = Infinity, hi = -Infinity;
            for (let pi = 0; pi < pathOrder.length; pi++) {
                if (cliques[pathOrder[pi]].has(i)) { lo = Math.min(lo, pi); hi = Math.max(hi, pi); }
            }
            if (lo <= hi) {
                rawIntervals[comp[i]] = { lo: offset + lo * SCALE, hi: offset + (hi + 1) * SCALE };
            }
        }

        offset += pathOrder.length * SCALE + GAP;
    }

    // Normalise to [0, 100]
    const total = offset;
    const intervals = rawIntervals.map(d =>
        d ? { start: (d.lo / total) * 100, end: (d.hi / total) * 100 } : null
    );

    return { isInterval: true, intervals };
}

// ============================================================
// Graph-Editor application
// ============================================================

class GraphCheckerApp {
    constructor() {
        this.nodes = [];   // { id, x, y, name, color }
        this.edges = [];   // { id, source, target }   (source/target = node IDs)
        this.nextNodeId = 0;
        this.nextEdgeId = 0;
        this.tool = 'addNode';
        this.edgeStartId = null;   // first node selected for edge creation
        this.hoverEdgeId = null;
        this.hoverNodeId = null;
        this.wasDragged = false;
        this.dragStartPos = null;

        this.COLORS = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
            '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
            '#E63946', '#A8DADC', '#457B9D', '#F77F00', '#06A77D',
        ];
        this.colorIdx = 0;
        this.lastValidIntervals = null; // Store intervals for export

        this.svgEl = document.getElementById('graphEditorSvg');
        this.resultCanvas = document.getElementById('resultCanvas');
        this.resultCtx = this.resultCanvas.getContext('2d');

        this.initSvg();
        this.setupToolButtons();
        this.setupExampleButtons();
        this.setupClearButton();
        this.setupExportButton();
        this.setupFullscreen();
        this.render();
        this.updateResult();
    }

    // ── SVG setup ──────────────────────────────────────────────

    initSvg() {
        this.svg = d3.select(this.svgEl);
        this.refreshSvgSize();

        // Click on empty space
        this.svg.on('click', (event) => {
            if (this.wasDragged) return;
            if (this.tool === 'addNode') {
                const [x, y] = d3.pointer(event);
                this.addNode(x, y);
            } else if (this.tool === 'addEdge' && this.edgeStartId !== null) {
                // Clicked empty space → cancel edge creation
                this.edgeStartId = null;
                this.render();
            }
        });

        // Preview line while drawing an edge
        this.svg.on('mousemove', (event) => {
            if (this.tool === 'addEdge' && this.edgeStartId !== null) {
                const [x, y] = d3.pointer(event);
                this.svg.select('.edge-preview')
                    .attr('x2', x).attr('y2', y).attr('opacity', 1);
            }
        });

        window.addEventListener('resize', () => {
            this.refreshSvgSize();
            this.render();
        });
    }

    refreshSvgSize() {
        const el = this.svgEl.parentElement;
        this.svgWidth = el.clientWidth;
        this.svgHeight = el.clientHeight;
        this.svgEl.setAttribute('width', this.svgWidth);
        this.svgEl.setAttribute('height', this.svgHeight);
    }

    // ── UI controls ────────────────────────────────────────────

    setupToolButtons() {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.tool = btn.dataset.tool;
                this.edgeStartId = null;
                this.hoverNodeId = null;
                this.hoverEdgeId = null;
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateHint();
                this.render();
            });
        });
        this.updateHint();
    }

    updateHint() {
        const hints = {
            addNode: 'Click empty space to add a node • Drag nodes to reposition',
            addEdge: 'Click a node to start an edge, then click another node to connect',
            delete:  'Click a node or edge to delete it',
        };
        document.getElementById('editorHint').textContent = hints[this.tool] || '';
    }

    setupExampleButtons() {
        document.getElementById('exampleIntervalBtn').addEventListener('click', () => this.loadExampleInterval());
        document.getElementById('exampleNonIntervalBtn').addEventListener('click', () => this.loadExampleNonInterval());
    }

    setupClearButton() {
        document.getElementById('clearGraphBtn').addEventListener('click', () => {
            if (this.nodes.length > 0 && !confirm('Clear the graph?')) return;
            this.nodes = [];
            this.edges = [];
            this.edgeStartId = null;
            this.colorIdx = 0;
            this.render();
            this.updateResult();
        });
    }

    setupExportButton() {
        document.getElementById('exportIntervalsBtn').addEventListener('click', () => this.exportIntervals());
    }

    setupFullscreen() {
        const toggle = (sectionId, btnId, afterToggle) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            const section = document.getElementById(sectionId);
            btn.addEventListener('click', () => {
                const isFs = section.classList.toggle('section-fullscreen');
                btn.textContent = isFs ? '✕' : '⛶';
                btn.title = isFs ? 'Exit fullscreen (Esc)' : 'Fullscreen';
                setTimeout(afterToggle, 50);
            });
        };

        toggle('graphEditorSection', 'graphEditorFullscreenBtn', () => {
            this.refreshSvgSize();
            this.render();
        });
        toggle('resultsSection', 'resultFullscreenBtn', () => {
            this.redrawResultCanvas();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.section-fullscreen').forEach(el => {
                    el.classList.remove('section-fullscreen');
                    const btn = el.querySelector('.fullscreen-btn');
                    if (btn) { btn.textContent = '⛶'; btn.title = 'Fullscreen'; }
                });
                setTimeout(() => {
                    this.refreshSvgSize();
                    this.render();
                    this.redrawResultCanvas();
                }, 50);
            }
        });
    }

    // ── Graph mutations ────────────────────────────────────────

    getNextName() {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        // Find the first unused single-letter name, then two-character names
        for (let i = 0; ; i++) {
            const name = i < 26
                ? letters[i]
                : letters[Math.floor(i / 26) - 1] + letters[i % 26];
            if (!this.nodes.some(n => n.name === name)) return name;
        }
    }

    addNode(x, y) {
        this.nodes.push({
            id: this.nextNodeId++,
            x: Math.max(25, Math.min(this.svgWidth - 25, x)),
            y: Math.max(25, Math.min(this.svgHeight - 25, y)),
            name: this.getNextName(),
            color: this.COLORS[this.colorIdx % this.COLORS.length],
        });
        this.colorIdx++;
        this.render();
        this.updateResult();
    }

    deleteNode(id) {
        this.nodes = this.nodes.filter(n => n.id !== id);
        this.edges = this.edges.filter(e => e.source !== id && e.target !== id);
        if (this.edgeStartId === id) this.edgeStartId = null;
        this.render();
        this.updateResult();
    }

    addEdge(srcId, tgtId) {
        if (srcId === tgtId) return;
        if (this.edges.some(e =>
            (e.source === srcId && e.target === tgtId) ||
            (e.source === tgtId && e.target === srcId))) return;
        this.edges.push({ id: this.nextEdgeId++, source: srcId, target: tgtId });
        this.render();
        this.updateResult();
    }

    deleteEdge(id) {
        this.edges = this.edges.filter(e => e.id !== id);
        this.render();
        this.updateResult();
    }

    // ── Interaction handlers ───────────────────────────────────

    handleNodeClick(d) {
        if (this.tool === 'addEdge') {
            if (this.edgeStartId === null) {
                this.edgeStartId = d.id;
                this.render();
            } else if (this.edgeStartId !== d.id) {
                this.addEdge(this.edgeStartId, d.id);
                this.edgeStartId = null;
            } else {
                // Clicked same node again → cancel
                this.edgeStartId = null;
                this.render();
            }
        } else if (this.tool === 'delete') {
            this.deleteNode(d.id);
        }
    }

    // ── Rendering ─────────────────────────────────────────────

    render() {
        const svg = this.svg;
        svg.selectAll('*').remove();

        const nodeMap = new Map(this.nodes.map(n => [n.id, n]));

        // Edge preview line (for edge-creation mode)
        const startNode = this.edgeStartId !== null ? nodeMap.get(this.edgeStartId) : null;
        svg.append('line')
            .attr('class', 'edge-preview')
            .attr('x1', startNode ? startNode.x : 0)
            .attr('y1', startNode ? startNode.y : 0)
            .attr('x2', startNode ? startNode.x : 0)
            .attr('y2', startNode ? startNode.y : 0)
            .attr('stroke', '#667eea')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '6,4')
            .attr('opacity', 0)
            .attr('pointer-events', 'none');

        // Edges
        svg.append('g').attr('class', 'edges')
            .selectAll('line')
            .data(this.edges)
            .join('line')
            .attr('x1', d => nodeMap.get(d.source)?.x ?? 0)
            .attr('y1', d => nodeMap.get(d.source)?.y ?? 0)
            .attr('x2', d => nodeMap.get(d.target)?.x ?? 0)
            .attr('y2', d => nodeMap.get(d.target)?.y ?? 0)
            .attr('stroke', d => this.hoverEdgeId === d.id ? '#e53935' : '#999')
            .attr('stroke-width', d => this.hoverEdgeId === d.id ? 5 : 2.5)
            .attr('stroke-opacity', 0.85)
            .style('cursor', this.tool === 'delete' ? 'pointer' : 'default')
            .on('mousedown', (event, d) => {
                if (this.tool === 'delete') {
                    this.edgeToDelete = d.id;
                }
            })
            .on('mouseup', (event, d) => {
                if (this.tool === 'delete' && this.edgeToDelete === d.id) {
                    event.stopPropagation(); 
                    this.deleteEdge(d.id);
                    this.edgeToDelete = null;
                }
            })
            .on('mouseenter', (event, d) => {
                // Update stroke directly on hover - don't call render()
                if (this.tool === 'delete') {
                    d3.select(event.currentTarget).attr('stroke', '#e53935').attr('stroke-width', 5);
                }
            })
            .on('mouseleave', (event, d) => {
                // Reset stroke directly - don't call render()
                if (this.tool === 'delete') {
                    d3.select(event.currentTarget).attr('stroke', '#999').attr('stroke-width', 2.5);
                }
            });

        // Nodes
        const dragBehavior = d3.drag()
            .on('start', (event, d) => {
                this.wasDragged = false;
                this.dragStartNode = { x: d.x, y: d.y };
                event.sourceEvent.stopPropagation();
            })
            .on('drag', (event, d) => {
                if (Math.abs(event.dx) > 0.1 || Math.abs(event.dy) > 0.1) this.wasDragged = true;
                // Get pointer position in SVG coordinates
                const [pointerX, pointerY] = d3.pointer(event.sourceEvent, this.svgEl);
                d.x = Math.max(25, Math.min(this.svgWidth - 25, pointerX));
                d.y = Math.max(25, Math.min(this.svgHeight - 25, pointerY));
                this.render();
            })
            .on('end', (event, d) => {
                if (!this.wasDragged) this.handleNodeClick(d);
                this.wasDragged = false;
            });

        const nodeEl = svg.append('g').attr('class', 'nodes')
            .selectAll('g')
            .data(this.nodes)
            .join('g')
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .style('cursor', this.tool === 'delete' ? 'pointer' : 'grab');
        
        // Only attach drag behavior when not in delete mode
        if (this.tool !== 'delete') {
            nodeEl.call(dragBehavior);
        }
        
        // Circle
        const circles = nodeEl.append('circle')
            .attr('r', 22)
            .attr('fill', d => d.color)
            .attr('stroke', d => {
                if (d.id === this.edgeStartId) return '#667eea';
                if (this.tool === 'delete' && d.id === this.hoverNodeId) return '#e53935';
                return '#fff';
            })
            .attr('stroke-width', d =>
                d.id === this.edgeStartId || (this.tool === 'delete' && d.id === this.hoverNodeId) ? 4 : 2.5
            )
            .on('mousedown', (event, d) => {
                if (this.tool === 'delete') {
                    this.nodeToDelete = d.id;
                } else if (this.tool === 'addEdge') {
                    this.nodeToClick = d;
                }
            })
            .on('mouseup', (event, d) => {
                if (this.tool === 'delete' && this.nodeToDelete === d.id) {
                    event.stopPropagation();
                    this.deleteNode(d.id);
                    this.nodeToDelete = null;
                } else if (this.tool === 'addEdge' && this.nodeToClick && this.nodeToClick.id === d.id) {
                    this.handleNodeClick(d);
                    this.nodeToClick = null;
                }
            })
            .on('mouseenter', (event, d) => {
                // Update stroke directly on hover - don't call render()
                if (this.tool === 'delete') {
                    d3.select(event.currentTarget).attr('stroke', '#e53935').attr('stroke-width', 4);
                }
            })
            .on('mouseleave', (event, d) => {
                // Reset stroke directly - don't call render()
                if (this.tool === 'delete') {
                    const stroke = d.id === this.edgeStartId ? '#667eea' : '#fff';
                    const strokeWidth = d.id === this.edgeStartId ? 4 : 2.5;
                    d3.select(event.currentTarget).attr('stroke', stroke).attr('stroke-width', strokeWidth);
                }
            });
        
        // Label
        nodeEl.append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', '#fff')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .attr('pointer-events', 'none')
            .text(d => d.name);

        // Placeholder text when empty
        if (this.nodes.length === 0) {
            svg.append('text')
                .attr('x', this.svgWidth / 2).attr('y', this.svgHeight / 2)
                .attr('text-anchor', 'middle')
                .attr('fill', '#bbb').attr('font-size', '16px')
                .text('Click to add nodes');
        }
    }

    // ── Result calculation & display ──────────────────────────

    buildAdjacency() {
        const n = this.nodes.length;
        const nodeIndex = new Map(this.nodes.map((node, i) => [node.id, i]));
        const adj = Array.from({ length: n }, () => new Set());
        this.edges.forEach(edge => {
            const ui = nodeIndex.get(edge.source);
            const vi = nodeIndex.get(edge.target);
            if (ui !== undefined && vi !== undefined) {
                adj[ui].add(vi);
                adj[vi].add(ui);
            }
        });
        return adj;
    }

    updateResult() {
        const n = this.nodes.length;
        const resultContent = document.getElementById('resultContent');
        const intervalSection = document.getElementById('intervalResultSection');

        if (n === 0) {
            this.lastValidIntervals = null; // Clear stored intervals
            resultContent.innerHTML = '<div class="result-empty">Add nodes and edges to analyze the graph.</div>';
            intervalSection.style.display = 'none';
            return;
        }

        const adj = this.buildAdjacency();
        const result = checkIntervalGraph(n, adj);

        if (result.isInterval) {
            this.lastValidIntervals = result.intervals; // Store for export
            resultContent.innerHTML = `
                <div class="result-yes">
                    <div class="result-verdict">
                        <span class="result-icon">✓</span>
                        <strong>This is an interval graph!</strong>
                    </div>
                    <div class="result-reason">
                        The graph is chordal and its maximal cliques can be linearly ordered
                        with the Consecutive Ones Property. One valid interval representation
                        is shown below.
                    </div>
                </div>`;
            intervalSection.style.display = 'block';
            this.drawIntervalResult(result.intervals);
        } else {
            this.lastValidIntervals = null; // Clear stored intervals
            const reason = result.reason === 'not_chordal'
                ? 'The graph contains an induced cycle of length ≥ 4 and is therefore <strong>not chordal</strong>. Every interval graph must be chordal.'
                : 'The graph is chordal, but its maximal cliques cannot be arranged in a linear order satisfying the Consecutive Ones Property. This means the graph contains an <strong>asteroidal triple</strong> and is not an interval graph.';
            resultContent.innerHTML = `
                <div class="result-no">
                    <div class="result-verdict">
                        <span class="result-icon">✗</span>
                        <strong>This is NOT an interval graph.</strong>
                    </div>
                    <div class="result-reason">${reason}</div>
                </div>`;
            intervalSection.style.display = 'none';
        }
    }

    drawIntervalResult(intervals) {
        const canvas = this.resultCanvas;
        const container = canvas.parentElement;
        const w = Math.max(300, container.clientWidth - 10);

        const padding = 55;
        const lineY = 45;
        const intervalHeight = 22;
        const spacing = 32;

        // Assign levels (greedy, by start position)
        const levelEnds = [];
        const nodeLevels = new Array(this.nodes.length).fill(-1);
        const sorted = this.nodes
            .map((node, i) => ({ node, i, iv: intervals[i] }))
            .filter(d => d.iv)
            .sort((a, b) => a.iv.start - b.iv.start);

        sorted.forEach(({ i, iv }) => {
            let level = 0;
            while (level < levelEnds.length && levelEnds[level] > iv.start) level++;
            nodeLevels[i] = level;
            if (level >= levelEnds.length) levelEnds.push(iv.end);
            else levelEnds[level] = iv.end;
        });

        const numLevels = Math.max(1, levelEnds.length);
        const h = lineY + 50 + numLevels * spacing + 10;

        canvas.width = w;
        canvas.height = h;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';

        const ctx = this.resultCtx;
        ctx.clearRect(0, 0, w, h);

        const lineStart = padding;
        const lineEnd = w - padding;
        const lineLength = lineEnd - lineStart;

        // Axis line
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lineStart, lineY);
        ctx.lineTo(lineEnd, lineY);
        ctx.stroke();

        // Tick marks
        ctx.font = '11px Arial';
        ctx.fillStyle = '#777';
        ctx.textAlign = 'center';
        for (let i = 0; i <= 10; i++) {
            const x = lineStart + (lineLength * i / 10);
            ctx.beginPath();
            ctx.moveTo(x, lineY - 4); ctx.lineTo(x, lineY + 4);
            ctx.stroke();
            ctx.fillText((i * 10).toString(), x, lineY + 17);
        }

        // Intervals
        this.nodes.forEach((node, i) => {
            const iv = intervals[i];
            if (!iv || nodeLevels[i] < 0) return;

            const y = lineY + 40 + nodeLevels[i] * spacing;
            const xS = lineStart + (lineLength * iv.start / 100);
            const xE = lineStart + (lineLength * iv.end / 100);

            ctx.save();
            ctx.strokeStyle = node.color;
            ctx.lineWidth = intervalHeight;
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(xS, y); ctx.lineTo(xE, y); ctx.stroke();

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(node.name, (xS + xE) / 2, y + 5);

            ctx.font = '10px Arial';
            ctx.fillStyle = '#444';
            ctx.fillText(iv.start.toFixed(1), xS, y - 14);
            ctx.fillText(iv.end.toFixed(1), xE, y - 14);
            ctx.restore();
        });
    }

    redrawResultCanvas() {
        if (document.getElementById('intervalResultSection').style.display === 'none') return;
        const adj = this.buildAdjacency();
        const result = checkIntervalGraph(this.nodes.length, adj);
        if (result.isInterval) this.drawIntervalResult(result.intervals);
    }

    exportIntervals() {
        if (!this.lastValidIntervals) {
            console.warn('No valid intervals to export');
            return;
        }
        
        const intervals = [];
        let id = 1;
        
        // Transform graph-checker format to index.html format
        for (let i = 0; i < this.nodes.length; i++) {
            const interval = this.lastValidIntervals[i];
            if (interval) {
                intervals.push({
                    id: id++,
                    name: this.nodes[i].name,
                    start: interval.start,
                    end: interval.end,
                    color: this.nodes[i].color
                });
            }
        }
        
        const data = {
            intervals: intervals,
            nextId: id,
            colorIndex: intervals.length,
            version: '1.0'
        };
        
        // Create and download JSON file
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `intervals_from_graph_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── Example graphs ─────────────────────────────────────────

    loadExampleInterval() {
        // Path A-B-C-D with extra chords A-C and B-D, making it a chordal interval graph
        this.reset();
        const cx = this.svgWidth / 2, cy = this.svgHeight / 2;
        const xs = [cx - 180, cx - 60, cx + 60, cx + 180];
        xs.forEach((x, i) => {
            this.nodes.push({
                id: this.nextNodeId++,
                x, y: cy,
                name: String.fromCharCode(65 + i),
                color: this.COLORS[this.colorIdx++ % this.COLORS.length],
            });
        });
        // A-B, B-C, C-D (path), plus chords A-C, B-D
        [[0,1],[1,2],[2,3],[0,2],[1,3]].forEach(([a, b]) =>
            this.edges.push({ id: this.nextEdgeId++, source: this.nodes[a].id, target: this.nodes[b].id })
        );
        this.render(); this.updateResult();
    }

    loadExampleNonInterval() {
        // Net graph: triangle A-B-C with pendant nodes D-A, E-B, F-C
        // Chordal but NOT an interval graph (clique intersection graph is a star K₁,₃)
        this.reset();
        const cx = this.svgWidth / 2, cy = this.svgHeight / 2;
        const positions = [
            { x: cx,       y: cy - 80,  name: 'A' },
            { x: cx - 80,  y: cy + 50,  name: 'B' },
            { x: cx + 80,  y: cy + 50,  name: 'C' },
            { x: cx,       y: cy - 185, name: 'D' },
            { x: cx - 185, y: cy + 115, name: 'E' },
            { x: cx + 185, y: cy + 115, name: 'F' },
        ];
        positions.forEach(p => {
            this.nodes.push({
                id: this.nextNodeId++,
                x: p.x, y: p.y, name: p.name,
                color: this.COLORS[this.colorIdx++ % this.COLORS.length],
            });
        });
        const idOf = name => this.nodes.find(n => n.name === name).id;
        [['A','B'],['B','C'],['A','C'],['D','A'],['E','B'],['F','C']].forEach(([a, b]) =>
            this.edges.push({ id: this.nextEdgeId++, source: idOf(a), target: idOf(b) })
        );
        this.render(); this.updateResult();
    }

    reset() {
        this.nodes = []; this.edges = [];
        this.nextNodeId = 0; this.nextEdgeId = 0;
        this.edgeStartId = null; this.colorIdx = 0;
    }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new GraphCheckerApp(); });
