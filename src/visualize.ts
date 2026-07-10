import * as d3 from 'd3';
import * as Tone from 'tone';

import { Nodes, getVoices, NodeConfig, VoiceConfig, MarkovConfig } from "./nodes.ts";

export interface CustomNode extends d3.SimulationNodeDatum {
    id: string;
    weight: number;
    radius: number;
    is_rest: boolean;
    is_odd: boolean;
}

export interface CustomLink extends d3.SimulationLinkDatum<CustomNode> {
    weight: number;
    force: number;
    likelihood: number;
}

interface GraphData {
    nodes: CustomNode[];
    links: CustomLink[];
}

function getBisectedCircle(x: number, y: number, radius: number) {
    let mid_y = y + 2*radius;
    return `M${x},${y},` +
            `A${radius},${radius},0,1,1,${x},${mid_y},` +
            `A${radius},${radius},0,1,1,${x+1},${mid_y}`;
}

function getBisectedArc(x_source: number, y_source: number,
                        x_target: number, y_target: number,
                        source_is_odd: boolean, radius_multiplier: number) {
    let dx = x_target - x_source;
    let dy = y_target - y_source;
    
    let x_center = (x_source + x_target) / 2;
    let y_center = (y_source + y_target) / 2;
    let is_odd = source_is_odd ? 1 : 0;
    let dx_mid = radius_multiplier * (source_is_odd ? 1 : -1) * dy / 2;
    let dy_mid = radius_multiplier * (source_is_odd ? -1 : 1) * dx / 2;
    let x_mid = x_center + dx_mid;
    let y_mid = y_center + dy_mid;
    
    let w = Math.sqrt(dx*dx + dy*dy);
    let h = Math.sqrt(dx_mid*dx_mid + dy_mid*dy_mid);
    let r = h/2 + w*w/h/8;
    
    return `M${x_source},${y_source},` +
            `A${r},${r},0,0,${source_is_odd?1:0},${x_mid},${y_mid},` +
            `A${r},${r},0,0,${source_is_odd?1:0},${x_target},${y_target}`;
}

// 3. Render function
export function createForceGraph(element_id: string, markov_config: MarkovConfig) {
    let nodes : CustomNode[] = []
    let links: CustomLink[] = []
    let i = 0
    for (const node_config of markov_config.nodes) {
        let num_ticks = Tone.Time(node_config.next_node_duration).toTicks();
        let tick_factor = 1 - Math.exp(-num_ticks / 400);
        
        let node: CustomNode = {
            id: node_config.id,
            weight: num_ticks,
            radius: 12 + 24 * tick_factor,
            is_rest: !node_config.note,
            is_odd: i % 2 == 1,
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
                    force: 0.3 - 0.2 * tick_factor,
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
               .strength(d => d.force))
        .force('charge', d3.forceManyBody()
               .strength(-300));

    // 3. Render Link Elements
    svg.append("defs")
        .append("marker").data(links)
            .attr("id", "arrowhead")
            .attr("viewBox", "-10 -5 10 10")
            .attr("refX", 0)
            .attr("refY", 0)
            .attr("markerWidth", 5)
            .attr("markerHeight", 5)
            .attr("orient", "auto")
            .attr('stroke', '#65452F')
            .attr('fill', '#65452F')
            .attr('fill-opacity', 1.0)
        .append("path")
            .attr("d", "M-10,-5L0,0L-10,5");
    
    const link = svg.append('g').data(links)
        .attr('stroke', '#65452F')
        .attr('stroke-opacity', 1.0)
        .attr('stroke-width', 4)
        .attr('fill-opacity', 0)
        .selectAll('path')
        .data(links)
        .join('path')
        .attr("marker-mid", d => "url(#arrowhead)");

    // 4. Render Node Elements
    const node = svg.append('g')
        .attr('stroke', '#111729')
        .attr('stroke-width', 4)
        .selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('r', (d: CustomNode) => d.radius)
        .attr('id', (d: CustomNode) => d.id)
        .attr('fill', (d: CustomNode) => d.is_rest ? '#FFFFFF' : '#E4B142');

    // 5. Update Positions via Tick Event
    simulation.on('tick', () => {
        link.attr("d", function(d) {
            let source_id = (d.source as CustomNode).id;
            let target_id = (d.target as CustomNode).id;
            
            if (source_id == target_id) {
                return getBisectedCircle((d.source as CustomNode).x!, (d.source as CustomNode).y!, 50);
            } else if (source_id < target_id) {
                return getBisectedArc((d.source as CustomNode).x!, (d.source as CustomNode).y!,
                                      (d.target as CustomNode).x!, (d.target as CustomNode).y!,
                                      (d.source as CustomNode).is_odd!, 0.6);
            } else {
                return getBisectedArc((d.source as CustomNode).x!, (d.source as CustomNode).y!,
                                      (d.target as CustomNode).x!, (d.target as CustomNode).y!,
                                      true, 0.75);
            }
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

