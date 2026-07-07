import * as d3 from 'd3';
import * as Tone from 'tone';

import { Nodes, getVoices, NodeConfig, VoiceConfig, MarkovConfig } from "./nodes.ts";

export interface CustomNode extends d3.SimulationNodeDatum {
    id: string;
    weight: number;
    is_rest: boolean;
}

export interface CustomLink extends d3.SimulationLinkDatum<CustomNode> {
    weight: number;
    likelihood: number;
}

interface GraphData {
    nodes: CustomNode[];
    links: CustomLink[];
}

//function zoomed(event) {
//    chartGroup.attr("transform", event.transform);
//}

// 3. Render function
export function createForceGraph(element_id: string, markov_config: MarkovConfig) {
    let nodes : CustomNode[] = []
    let links: CustomLink[] = []
    let i = 0
    for (const node_config of markov_config.nodes) {
        let node: CustomNode = {
            id: node_config.id,
            weight: Tone.Frequency(node_config.next_node_duration).toTicks(),
            is_rest: !node_config.note,
            x: 100 * i - 100 * markov_config.nodes.length / 2,
            y: window.innerHeight / 2 + Math.random() * 500 - 250
        };
        nodes.push(node)
        
        let total_weight = 0
        if (node_config.next_nodes) {
            for (const next_node_config of node_config.next_nodes) {
                total_weight = total_weight + next_node_config.weight
            }
            for (const next_node_config of node_config.next_nodes) {
                let link: CustomLink = {
                    source: node.id,
                    target: next_node_config.id,
                    weight: node.weight,
                    likelihood: next_node_config.weight / total_weight
                };
                links.push(link)
            }
        }
        
        i = i + 1
    }
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    const svg = d3.select(element_id)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style("border", "1px solid #ccc")
        .style("pointer-events", "all")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMaxYMax meet");
    
    // 2. Initialize the Forces (No Drag Behavior Added)
    const simulation = d3.forceSimulation<CustomNode>(nodes)
        .force('link', d3.forceLink<CustomNode, CustomLink>(links)
               .id(d => d.id)
               .strength(0.1))
        .force('charge', d3.forceManyBody()
               .strength(-300));

    // 3. Render Link Elements
    const link = svg.append('g')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke-width', (d: CustomLink) => Math.sqrt(d.weight));

    // 4. Render Node Elements
    const node = svg.append('g')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('r', 8)
        .attr('fill', '#42b983');

    // 5. Update Positions via Tick Event
    simulation.on('tick', () => {
        link
          .attr('x1', (d: CustomLink) => (d.source as CustomNode).x ?? 0)
          .attr('y1', (d: CustomLink) => (d.source as CustomNode).y ?? 0)
          .attr('x2', (d: CustomLink) => (d.target as CustomNode).x ?? 0)
          .attr('y2', (d: CustomLink) => (d.target as CustomNode).y ?? 0);

        node
          .attr('cx', (d: CustomNode) => d.x ?? 0)
          .attr('cy', (d: CustomNode) => d.y ?? 0);
    });
    
    // 6. Set up Zoom.
    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.01, 1])
        .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, any>) => {
            node.attr("transform", event.transform.toString());
            link.attr("transform", event.transform.toString());
        });
    svg.call(zoom);
}

