// MindVault Interactive Canvas Knowledge Graph
class KnowledgeGraphEngine {
  constructor(canvasId, data) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.data = data;
    this.nodes = [];
    this.edges = data.edges;
    this.hoveredNode = null;
    this.selectedNode = null;
    this.animationId = null;
    this.dragNode = null;
    // All listeners are removed together in destroy(), so re-rendering the graph doesn't stack them
    this.listeners = new AbortController();

    this.init();
  }

  // Positions you dragged bubbles to, stored as fractions of the canvas so they survive resizes
  static storageKey = 'MINDVAULT_GRAPH_POSITIONS';
  // How far (px) a bubble floats around its spot
  static sway = 4;

  nodeKey(node) {
    return node.type === 'topic' ? `topic:${String(node.label || '').toLowerCase()}` : node.id;
  }

  loadPositions() {
    try { return JSON.parse(localStorage.getItem(KnowledgeGraphEngine.storageKey) || '{}') || {}; } catch (e) { return {}; }
  }

  savePosition(node) {
    const all = this.loadPositions();
    all[this.nodeKey(node)] = { x: node.x / this.canvas.width, y: node.y / this.canvas.height };
    try { localStorage.setItem(KnowledgeGraphEngine.storageKey, JSON.stringify(all)); } catch (e) {}
  }

  resetPositions() {
    try { localStorage.removeItem(KnowledgeGraphEngine.storageKey); } catch (e) {}
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize(), { signal: this.listeners.signal });

    // Position nodes in radial cluster
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const friendNodes = this.data.nodes.filter(n => n.type === 'friend');
    const topicNodes = this.data.nodes.filter(n => n.type === 'topic');

    let friendCount = 0;
    let topicCount = 0;

    this.nodes = this.data.nodes.map((node) => {
      let x, y, radius, color, scoreLabel = '';

      if (node.type === 'user') {
        x = centerX;
        y = centerY;
        radius = 30;
        color = '#EA8DB6';
      } else if (node.type === 'friend') {
        const totalF = Math.max(friendNodes.length, 1);
        const angle = (friendCount / totalF) * Math.PI * 2 - Math.PI / 2;
        friendCount++;

        const score = node.score !== undefined ? node.score : 80;
        scoreLabel = `${score}%`;

        // INTIMACY DISTANCE FORMULA:
        // High Intimacy (80-100%) -> Very close to user center (0.18 - 0.22 * minDimension)
        // Medium Intimacy (50-79%) -> Middle orbit (0.28 - 0.34 * minDimension)
        // Low / Conflict Intimacy (10-49%) -> Far outer orbit / drifting away (0.42 - 0.46 * minDimension)
        const minDim = Math.min(width, height);
        const normalizedIntimacy = Math.max(0.1, Math.min(1.0, score / 100)); // 0.1 to 1.0
        
        // Closer distance for higher intimacy
        const dist = minDim * (0.45 - (normalizedIntimacy * 0.25));

        // Spread out over the whole canvas (it can be wider or taller than it is square)
        x = centerX + Math.cos(angle) * dist * (width / Math.min(width, height));
        y = centerY + Math.sin(angle) * dist * (height / Math.min(width, height));

        // Node size based on intimacy (kept small: the score is drawn as a ring, not a separate bubble)
        radius = Math.round(13 + normalizedIntimacy * 5); // 13px for low score up to 18px for close friends

        // Visual Color Coding:
        // High (Green/Purple gradient), Medium (Yellow/Amber), Conflict/Low (Crimson Red)
        if (node.state === 'conflict') {
          color = '#EF4444'; // Red for conflict / needs repair
        } else if (node.state === 'cooling') {
          color = '#F59E0B'; // Amber for cooling down
        } else {
          color = '#8B5CF6'; // Purple for close friendship
        }
      } else {
        const totalT = Math.max(topicNodes.length, 1);
        const angle = (topicCount / totalT) * Math.PI * 2;
        topicCount++;
        const dist = Math.min(width, height) * 0.40; // leave room for the label under the outermost nodes
        // Spread out over the whole canvas (it can be wider or taller than it is square)
        x = centerX + Math.cos(angle) * dist * (width / Math.min(width, height));
        y = centerY + Math.sin(angle) * dist * (height / Math.min(width, height));
        radius = 16;
        color = '#059669';
      }

      return {
        ...node,
        x,
        y,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        radius,
        color,
        scoreLabel
      };
    });

    // Put dragged bubbles back where you left them
    const saved = this.loadPositions();
    this.nodes.forEach(node => {
      const pos = saved[this.nodeKey(node)];
      if (pos && node.type !== 'user') {
        node.x = pos.x * width;
        node.y = pos.y * height;
        node.pinned = true;
      }
    });

    this.setupEvents();
    this.animate();
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth || 800;
      this.canvas.height = this.neededHeight(this.canvas.width);
      this.canvas.style.height = this.canvas.height + 'px';
    }
  }

  // Make the canvas taller when there are many bubbles or a narrow screen, so they have room
  // to sit apart (with their names) instead of piling up
  neededHeight(width) {
    const ctx = this.ctx;
    ctx.font = '600 12px Plus Jakarta Sans';
    let area = 0;
    for (const node of this.data.nodes || []) {
      if (node.type === 'user') continue;
      const label = String(node.label || '');
      const w = Math.max(44, ctx.measureText(label).width + 18);
      const h = node.type === 'friend' ? 74 : 62;
      area += w * h;
    }
    // Packing is never perfect, so ask for roughly 2.5x the space the bubbles actually cover
    return Math.round(Math.min(1400, Math.max(480, (area * 2.5) / Math.max(width, 280))));
  }

  // Pointer position in canvas pixels (the canvas can be drawn smaller/larger than its pixel size)
  pointerPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
    };
  }

  nodeAt(x, y) {
    // Topmost first (nodes are drawn in order, so search backwards)
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i];
      if (Math.hypot(node.x - x, node.y - y) <= node.radius + 8) return node;
    }
    return null;
  }

  setupEvents() {
    const opts = { signal: this.listeners.signal };
    const canvas = this.canvas;

    // On touch screens, a finger on a bubble drags it; anywhere else still scrolls the page
    canvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      if (!t) return;
      const { x, y } = this.pointerPos(t);
      if (this.nodeAt(x, y)) e.preventDefault();
    }, { ...opts, passive: false });

    canvas.addEventListener('pointerdown', (e) => {
      const { x, y } = this.pointerPos(e);
      const node = this.nodeAt(x, y);
      if (!node) return;
      this.dragNode = node;
      this.dragStart = { x, y, nodeX: node.x, nodeY: node.y };
      this.dragMoved = false;
      node.dragging = true;
      // Bring it to the front so it's drawn above the others
      this.nodes.splice(this.nodes.indexOf(node), 1);
      this.nodes.push(node);
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      canvas.style.cursor = 'grabbing';
    }, opts);

    canvas.addEventListener('pointermove', (e) => {
      const { x, y } = this.pointerPos(e);
      if (this.dragNode) {
        const dx = x - this.dragStart.x;
        const dy = y - this.dragStart.y;
        if (!this.dragMoved && Math.hypot(dx, dy) < 4) return; // tiny wobble = still a click
        this.dragMoved = true;
        const pad = this.dragNode.radius + 4;
        this.dragNode.x = Math.max(pad, Math.min(canvas.width - pad, this.dragStart.nodeX + dx));
        this.dragNode.y = Math.max(pad, Math.min(canvas.height - pad - 20, this.dragStart.nodeY + dy));
        this.hoveredNode = this.dragNode;
        return;
      }
      const found = this.nodeAt(x, y);
      this.hoveredNode = found;
      canvas.style.cursor = found ? 'grab' : 'default';
    }, opts);

    const endDrag = (e) => {
      const node = this.dragNode;
      if (!node) return;
      node.dragging = false;
      this.dragNode = null;
      canvas.style.cursor = 'grab';
      if (this.dragMoved) {
        // Dropped: stay here (no more floating), and remember the spot
        node.pinned = true;
        node.vx = 0;
        node.vy = 0;
        this.savePosition(node);
        this.suppressClick = true;
        setTimeout(() => { this.suppressClick = false; }, 0);
      } else if (e.type === 'pointerup') {
        this.selectedNode = node;
        if (window.onGraphNodeClick) window.onGraphNodeClick(node);
      }
    };
    canvas.addEventListener('pointerup', endDrag, opts);
    canvas.addEventListener('pointercancel', endDrag, opts);
    canvas.addEventListener('pointerleave', () => { if (!this.dragNode) this.hoveredNode = null; }, opts);
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const minDim = Math.min(width, height);

    // Draw Orbit Circles (Intimacy Tiers)
    this.ctx.save();
    this.ctx.setLineDash([4, 6]);
    this.ctx.strokeStyle = 'rgba(234, 141, 182, 0.2)';
    this.ctx.lineWidth = 1;
    
    // Close Circle Orbit
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, minDim * 0.20, 0, Math.PI * 2);
    this.ctx.stroke();

    // Medium Orbit
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, minDim * 0.32, 0, Math.PI * 2);
    this.ctx.stroke();

    // Outer / Low Orbit
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, minDim * 0.44, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();

    // Keep bubbles AND their name labels from overlapping (including room for their sway)
    const boxes = this.nodes.map(node => this.footprint(node));
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i], b = this.nodes[j];
        const aFixed = a.type === 'user' || a.pinned || a.dragging;
        const bFixed = b.type === 'user' || b.pinned || b.dragging;
        if (aFixed && bFixed) continue;
        const A = boxes[i], B = boxes[j];
        const overlapX = Math.min(A.right, B.right) - Math.max(A.left, B.left);
        const overlapY = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
        if (overlapX <= 0 || overlapY <= 0) continue;
        // Push along whichever direction needs the smaller move
        let mx = 0, my = 0;
        // (two long names that can't fit side by side on a narrow screen go above/below each other)
        const fitSideBySide = (A.right - A.left) + (B.right - B.left) < width - 4;
        if (overlapX < overlapY && fitSideBySide) mx = (b.x >= a.x ? 1 : -1) * overlapX;
        else my = ((B.top + B.bottom) >= (A.top + A.bottom) ? 1 : -1) * overlapY;
        const k = 0.25 * (aFixed || bFixed ? 1 : 0.5);
        if (!aFixed) { a.x -= mx * k; a.y -= my * k; this.shiftBox(A, -mx * k, -my * k); }
        if (!bFixed) { b.x += mx * k; b.y += my * k; this.shiftBox(B, mx * k, my * k); }
      }
    }
    // Keep everything inside the canvas
    for (const node of this.nodes) {
      if (node.type === 'user' || node.dragging) continue;
      const f = this.footprint(node);
      if (f.left < 2) node.x += 2 - f.left;
      if (f.right > width - 2) node.x -= f.right - (width - 2);
      if (f.top < 2) node.y += 2 - f.top;
      if (f.bottom > height - 2) node.y -= f.bottom - (height - 2);
    }

    // Gentle floating: each bubble sways a few pixels around its own spot.
    // The spacing above leaves room for this, so swaying never makes them overlap.
    const t = performance.now() / 1000;
    for (const node of this.nodes) {
      if (node.type === 'user' || node.dragging) {
        node.drawX = node.x;
        node.drawY = node.y;
        continue;
      }
      if (node.phase === undefined) {
        node.phase = Math.random() * Math.PI * 2;
        node.speed = 0.5 + Math.random() * 0.5;
      }
      node.drawX = node.x + Math.sin(t * node.speed + node.phase) * KnowledgeGraphEngine.sway;
      node.drawY = node.y + Math.cos(t * node.speed * 0.8 + node.phase * 1.3) * KnowledgeGraphEngine.sway;
    }

    // Draw Edges
    for (const edge of this.edges) {
      const source = this.nodes.find(n => n.id === edge.from);
      const target = this.nodes.find(n => n.id === edge.to);

      if (source && target) {
        const isHighlighted = (this.hoveredNode && (this.hoveredNode.id === source.id || this.hoveredNode.id === target.id));
        
        let strokeColor = 'rgba(200, 180, 210, 0.35)';
        let lineWidth = 1.5;

        if (edge.score !== undefined) {
          if (edge.state === 'conflict') {
            strokeColor = isHighlighted ? 'rgba(239, 68, 68, 0.9)' : 'rgba(239, 68, 68, 0.35)';
          } else if (edge.state === 'cooling') {
            strokeColor = isHighlighted ? 'rgba(245, 158, 11, 0.9)' : 'rgba(245, 158, 11, 0.35)';
          } else {
            strokeColor = isHighlighted ? 'rgba(139, 92, 246, 0.9)' : 'rgba(139, 92, 246, 0.35)';
          }
          lineWidth = Math.max(1.2, (edge.score / 100) * 3);
        }

        this.ctx.beginPath();
        this.ctx.moveTo(source.drawX, source.drawY);
        this.ctx.lineTo(target.drawX, target.drawY);
        this.ctx.strokeStyle = isHighlighted ? 'rgba(234, 141, 182, 0.9)' : strokeColor;
        this.ctx.lineWidth = isHighlighted ? 3 : lineWidth;
        this.ctx.stroke();

        // Edge label if hovered
        if (isHighlighted && edge.label) {
          const midX = (source.drawX + target.drawX) / 2;
          const midY = (source.drawY + target.drawY) / 2;
          this.ctx.fillStyle = '#2D1A29';
          this.ctx.font = '700 11px Plus Jakarta Sans';
          this.ctx.fillText(edge.label, midX, midY - 6);
        }
      }
    }

    // Draw Nodes
    for (const node of this.nodes) {
      const isHovered = this.hoveredNode === node;

      // Glow effect
      if (isHovered) {
        this.ctx.beginPath();
        this.ctx.arc(node.drawX, node.drawY, node.radius + 8, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(248, 187, 217, 0.4)';
        this.ctx.fill();
      }

      if (node.type === 'friend') {
        // Friend: initials in a soft circle, closeness score as a ring around it
        const score = Math.max(0, Math.min(100, Number(node.score) || 0));
        const ringR = node.radius + 4;

        this.ctx.beginPath();
        this.ctx.arc(node.drawX, node.drawY, node.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fill();

        // Ring track
        this.ctx.beginPath();
        this.ctx.arc(node.drawX, node.drawY, ringR, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(45, 26, 41, 0.10)';
        this.ctx.lineWidth = 4;
        this.ctx.stroke();

        // Ring fill = score
        this.ctx.beginPath();
        this.ctx.arc(node.drawX, node.drawY, ringR, -Math.PI / 2, -Math.PI / 2 + (score / 100) * Math.PI * 2);
        this.ctx.strokeStyle = node.color;
        this.ctx.lineWidth = 4;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();
        this.ctx.lineCap = 'butt';

        const initials = String(node.label || '?').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase();
        this.ctx.fillStyle = node.color;
        this.ctx.font = '800 11px Plus Jakarta Sans';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(initials, node.drawX, node.drawY + 0.5);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(node.drawX, node.drawY, node.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = node.color;
        this.ctx.fill();
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.stroke();
      }

      // Node Label
      this.ctx.textBaseline = 'alphabetic';
      this.ctx.fillStyle = isHovered ? '#EA8DB6' : '#2D1A29';
      this.ctx.font = isHovered ? '700 13px Plus Jakarta Sans' : '600 12px Plus Jakarta Sans';
      this.ctx.textAlign = 'center';
      
      let displayLabel = this.labelText(node);
      // Show the exact score only on hover; the ring already shows it at a glance
      if (node.type === 'friend' && isHovered && node.score !== undefined) {
        displayLabel = `${displayLabel} · ${node.score}%`;
      }
      this.ctx.fillText(displayLabel, node.drawX, node.drawY + this.labelOffset(node));
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  labelText(node) {
    return node.type === 'friend' && node.state === 'conflict' ? `[!] ${node.label}` : String(node.label || '');
  }

  labelOffset(node) {
    return node.type === 'friend' ? node.radius + 20 : node.radius + 16;
  }

  // The area a node takes up: its circle (with the score ring) plus the name underneath
  footprint(node) {
    if (node.labelWidth === undefined || node.labelWidthFor !== node.label) {
      this.ctx.font = '600 12px Plus Jakarta Sans';
      node.labelWidth = this.ctx.measureText(this.labelText(node)).width;
      node.labelWidthFor = node.label;
    }
    const pad = node.type === 'user' ? 0 : KnowledgeGraphEngine.sway;
    const half = Math.max(node.radius + 7, node.labelWidth / 2 + 5) + pad;
    return {
      left: node.x - half,
      right: node.x + half,
      top: node.y - node.radius - 7 - pad,
      bottom: node.y + this.labelOffset(node) + 5 + pad
    };
  }

  shiftBox(box, dx, dy) {
    box.left += dx; box.right += dx; box.top += dy; box.bottom += dy;
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.listeners.abort();
  }
}
