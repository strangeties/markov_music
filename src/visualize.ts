import * as d3 from 'd3';
import * as Tone from 'tone';

import { Nodes, getVoices, NodeConfig, VoiceConfig, MarkovConfig } from "./nodes.ts";

const NODE_FILL_COLOR: string = '#E4B142';
const LINK_LINE_COLOR: string = '#65452F';

export interface CustomNode extends d3.SimulationNodeDatum {
    id: string;
    weight: number;
    radius: number;
    is_rest: boolean;
    is_odd: boolean;
    color: string;
}

export interface CustomLink extends d3.SimulationLinkDatum<CustomNode> {
    weight: number;
    force: number;
    likelihood: number;
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

export class ForceGraph {
    public constructor(element_id: string, markov_config: MarkovConfig) {
        this.transform = d3.zoomIdentity;
        
        let i = 0;
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
                y: node_config.id.endsWith("p1") ? window.innerHeight / 2 : window.innerHeight / 2 - Math.random() * 500,
                color: NODE_FILL_COLOR
            };
            this.nodes.push(node)
            
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
                    this.links.push(link)
                }
            }
            
            i = i + 1
        }
        
        const dpi = devicePixelRatio;
        let width =  dpi * window.innerWidth;
        let height = dpi * window.innerHeight
        this.canvas = d3.select(element_id).append("canvas")
            .attr("width", width)
            .attr("height", height)
            .attr("style", `width: ${width}px; max-width: 100%; height: auto;`);
        if (!this.canvas) {
            console.log('canvas is null : (');
            return;
        }
        this.context = this.canvas.node()!.getContext("2d");
        if (!this.context) {
            console.error('No context was created : (');
            return;
        }
        this.context.scale(dpi, dpi);
        

        const zoom = d3.zoom<HTMLCanvasElement, unknown>()
        .scaleExtent([0.01, 1]) // Set minimum and maximum zoom levels
        .on('zoom', (event: d3.D3ZoomEvent<HTMLCanvasElement, unknown>) => {
            if (!this.context) {
                console.log('in zoom, context is null : (')
            }
            this.transform = event.transform;
            this.draw();
        });
        this.canvas.call(zoom);
        
        this.simulation = d3.forceSimulation<CustomNode>(this.nodes)
            .force('link', d3.forceLink<CustomNode, CustomLink>(this.links)
                   .id(d => d.id)
                   .strength(d => d.force))
            .force('charge', d3.forceManyBody()
                   .strength(-300))
            .force("y", d3.forceY(0)
                   .strength(0.02))
            .on("tick", () => {this.draw()});
    }
    
    public draw() {
        if (!this.context) {
            console.log('context is null : (')
            return;
        }
        
        this.context.save();

        this.context.resetTransform();
        const dpi = devicePixelRatio;
        this.context.clearRect(0, 0, dpi * window.innerWidth,  dpi * window.innerHeight);
        
        if (this.transform) {
            this.context.translate(this.transform.x, this.transform.y);
            this.context.scale(this.transform.k, this.transform.k);
        }

        this.links.forEach((d) => {this.drawLink(d)});
        this.nodes.forEach((n) => {this.drawNode(n)});
        
        this.context.restore();
    }
    
    public drawLink(d: CustomLink) {
        if (!this.context) {
            console.log('drawLink: context is null : (')
            return;
        }
        
        let x1 = (d.source as CustomNode).x!;
        let y1 = (d.source as CustomNode).y!;
        let id1 = (d.source as CustomNode).id!;
        let x2 = (d.target as CustomNode).x!;
        let y2 = (d.target as CustomNode).y!;
        let id2 = (d.target as CustomNode).id!;
        
        if (id1 == id2) {
            this.drawArcBetweenPoints(this.context, x1, y1, x2, y2, 50, false)
            this.drawArrowAtArcMidpoint(this.context, x1, y1, x1, y1 + 100, x2-10, y2)
        } else if (id1 < id2) {
            const mid_arc_points = this.drawArcBetweenPointsWithRadiusMultipler(this.context,
                                                                           x1, y1,
                                                                           x2, y2, 0.5, (d.source as CustomNode).is_odd);
            this.drawArrowAtArcMidpoint(this.context, x1, y1,
                                   mid_arc_points[0], mid_arc_points[1],
                                   x2, y2);
        } else {
            const mid_arc_points = this.drawArcBetweenPointsWithRadiusMultipler(this.context,
                                                                           x1, y1,
                                                                           x2, y2, 0.7, false);
            this.drawArrowAtArcMidpoint(this.context, x1, y1,
                                   mid_arc_points[0], mid_arc_points[1],
                                   x2, y2);
        }
    }

    public drawNode(d: CustomNode) {
        if (!this.context) {
            console.log('drawNode: context is null : (')
            return;
        }
        
        this.context.beginPath();
        
        this.context.moveTo(d.x! + d.radius, d.y!);
        this.context.arc(d.x!, d.y!, d.radius, 0, 2 * Math.PI);
        
        this.context.globalAlpha = 1.0;
        this.context.fillStyle = d.color
        this.context.strokeStyle = "brown";
        this.context.lineWidth = 4;
        
        this.context.fill();
        this.context.stroke();
    }
    
    simulation: any;
    private canvas: any;
    private context: CanvasRenderingContext2D | null = null;
    nodes: CustomNode[] = [];
    links: CustomLink[] = [];
    transform: any;
    
    private drawArcBetweenPoints(ctx: any, x1: number, y1: number,
                                  x2: number, y2: number,
                                  radius: number = 50, counter_clockwise: boolean = false) {
        ctx.moveTo(x1, y1);
        ctx.beginPath();
        if (x1 == x2 && y1 == y2) {
            ctx.arc(x1, y1 + radius, radius, 0, 2*Math.PI, counter_clockwise);
        } else {
            
            // 1. Calculate the distance between the two points
            const dx = x2 - x1;
            const dy = y2 - y1;
            const distance = Math.hypot(dx, dy);
            
            // 2. Validation: A circle cannot bridge two points further apart than its diameter
            if (distance > 2 * radius) {
                console.error(`Radius is too small to connect these points - distance: ${distance}, 2*radius: ${2*radius}.`);
                return;
            }
            
            // 3. Find the midpoint between the two points
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            
            // 4. Calculate the distance from the midpoint to the center of the circle
            const h = Math.sqrt(radius * radius - (distance / 2) * (distance / 2));
            
            // 5. Calculate the center points (cx, cy)
            // Changing the sign of 'h' flips the arc to the alternative circle path
            const offsetDirection = counter_clockwise ? 1 : -1;
            const cx = mx + offsetDirection * h * (dy / distance);
            const cy = my - offsetDirection * h * (dx / distance);
            
            // 6. Calculate start and end angles using trigonometry
            const startAngle = Math.atan2(y1 - cy, x1 - cx);
            const endAngle = Math.atan2(y2 - cy, x2 - cx);
            
            // 7. Draw the arc using native context method
            ctx.arc(cx, cy, radius, startAngle, endAngle, counter_clockwise);
        }
        ctx.strokeStyle = LINK_LINE_COLOR;
        ctx.lineWidth = 4;
        ctx.stroke()
    }

    private drawArcBetweenPointsWithRadiusMultipler(ctx: any, x1: number, y1: number,
                                                     x2: number, y2: number,
                                                     radius_multiplier: number, counter_clockwise: boolean = false) {
        ctx.moveTo(x1, y1);
        ctx.beginPath();
        
        let dx = x2 - x1;
        let dy = y2 - y1;
        
        // Gets midpoint along linear connector.
        let x_mid_line = (x1 + x2) / 2;
        let y_mid_line = (y1 + y2) / 2;
        
        // Gets midpoint along arc.
        let dx_mid = radius_multiplier * (counter_clockwise ? 1 : -1) * dy / 2;
        let dy_mid = radius_multiplier * (counter_clockwise ? -1 : 1) * dx / 2;
        let x_mid_arc = x_mid_line + dx_mid;
        let y_mid_arc = y_mid_line + dy_mid;
        
        // Computes radius.
        let w = Math.hypot(dx, dy); // "Width": distance between points.
        let h = Math.hypot(dx_mid, dy_mid); // "Height": distance between midpoints of line to midpoint of arc
        let r = h / 2 + w * w / h / 8; // Radius!
        
        this.drawArcBetweenPoints(ctx, x1, y1, x2, y2, r, counter_clockwise)
        ctx.strokeStyle = LINK_LINE_COLOR;
        ctx.lineWidth = 4;
        ctx.stroke()
        
        return [x_mid_line - dx_mid, y_mid_line - dy_mid]
    }

    private drawArrowAtArcMidpoint(ctx: any, x1: number, y1: number, // Start
                                    x2: number, y2: number, // Midpoint
                                    x3: number, y3: number) { // Endpoint
        ctx.save();
        
        ctx.translate(x2, y2);
        ctx.rotate(Math.atan2(y3-y1, x3-x1));
        
        const arrow_size = 20;
        
        ctx.beginPath();
        ctx.moveTo(0, 0); // Tip of arrow
        ctx.lineTo(-arrow_size, 0.5*arrow_size); // Bottom left
        ctx.lineTo(-arrow_size * 0.8, 0); // Cutout to center
        ctx.lineTo(-arrow_size, -0.5*arrow_size); // Bottom right
        ctx.closePath();
        ctx.strokeStyle = LINK_LINE_COLOR;
        ctx.lineWidth = 4;
        ctx.fillStyle = LINK_LINE_COLOR;
        ctx.fill();
        
        ctx.restore();
    }

};
