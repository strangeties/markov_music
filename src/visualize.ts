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

function getRandomColor() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

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
            y: node_config.id.endsWith("p1") ? window.innerHeight / 2 : window.innerHeight / 2 - Math.random() * 500
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
               .strength(d => 0.3 - 0.1 * (1-Math.exp(-d.weight/400))))
        .force('charge', d3.forceManyBody()
               .strength(-300));

    // 3. Render Link Elements
    const link = svg.append('g')
        .attr('stroke', '#36281d')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', 4)
        .attr('fill-opacity', 0)
        .selectAll('line')
        .data(links)
        .join('path')
        .attr("marker-mid", "url(#arrow)");

    // 4. Render Node Elements
    const node = svg.append('g')
        .attr('stroke', '#36281d')
        .attr('stroke-width', 4)
        .selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('r', (d: CustomNode) => 12 + 24 * (1-Math.exp(-d.weight/400)))
        .attr('fill', (d: CustomNode) => d.is_rest ? '#FFFFFF' : '#E4B142');

    // 5. Update Positions via Tick Event
    simulation.on('tick', () => {
        link.attr("d", function(d) {
            var dx = (d.target as CustomNode)!.x! - (d.source as CustomNode)!.x!,
                dy = (d.target as CustomNode)!.y! - (d.source as CustomNode)!.y!,
                dr = Math.sqrt(dx * dx + dy * dy);
            return "M" + (d.source as CustomNode).x +
                    "," + (d.source as CustomNode).y +
                    "A" + dr + "," + dr + " 0 0,1 " +
                    (d.target as CustomNode).x + "," +
                    (d.target as CustomNode).y;
        });

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

