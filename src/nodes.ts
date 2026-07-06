import { Node } from "./node.ts";
import { Voice } from "./voice.ts";

import * as Tone from 'tone';

export interface NextNodeConfig {
    id: string;
    weight: number;
}

export interface NodeConfig {
    id: string;
    note: string | null;
    note_duration: string;
    next_node_duration: string;
    next_nodes: NextNodeConfig[];
}

export interface VoiceConfig {
    start_id: string;
    transpose_8va: number;
}

export interface MarkovConfig {
    nodes: NodeConfig[];
    voices: VoiceConfig[];
}

export class Nodes {
    public constructor(config: MarkovConfig) {
        this.nodes = new Map()
        for (const node_config of config.nodes) {
            let new_node = new Node(node_config.id, node_config.note, node_config.note_duration,
                                    node_config.next_node_duration)
            if (node_config.next_nodes) {
                for (const next_node_config of node_config.next_nodes) {
                    new_node.addNextNode(next_node_config.id, next_node_config.weight)
                }
            }
            this.nodes.set(new_node.getId(), new_node)
        }
        
        for (const [id, node] of this.nodes) {
            for (const next_node_id of node.getNextNodeIds()) {
                if (!this.nodes.has(next_node_id)) {
                    throw new Error(`setting up nodes: non-existent next_node ID, ${next_node_id}`);
                }
            }
        }
    }
    
    public getNode(id: string): Node | null {
        if (this.nodes.has(id)) {
            return this.nodes.get(id)!;
        }
        return null;
    }
    
    private nodes: Map<string, Node>;
}

export function getVoices(config: MarkovConfig, nodes: Nodes): Voice[] {
    let voices: Voice[] = [];
    for (const voice_config of config.voices) {
        if (nodes.getNode(voice_config.start_id)) {
            let voice = new Voice(nodes.getNode(voice_config.start_id)!,
                                  voice_config.transpose_8va);
            voices.push(voice);
        } else {
            throw new Error(`setting up voices: non-existent node ID, ${voice_config.start_id.toString()}`);
        }
    }
    
    return voices;
}
