import * as d3 from 'd3';
import * as Tone from 'tone';

import { Node } from "./node.ts";
import { Voice } from "./voice.ts";
import { Nodes, getVoices, NodeConfig, VoiceConfig, MarkovConfig } from "./nodes.ts";
import {ForceGraph, CustomNode} from "./visualize.ts";
//import in_c_data from "./in_c.json" with { type: "text" };
import in_c_data from './in_c.json';
import './styles.css';

let _markov_config: MarkovConfig | null = null
let _nodes: Nodes | null = null
let _voices: Voice[] = []
let _g: any = null
let _force_graph: ForceGraph | null = null

let _state: string = 'refreshed'
let _state_num_completed_voices: number = 0

export function setUp() {
    _markov_config = JSON.parse(JSON.stringify(in_c_data)) as MarkovConfig;
    _nodes = new Nodes(_markov_config);
    _voices = getVoices(_markov_config, _nodes);
}

export function playOrPauseOrRestart() {
    if (_state === 'refreshed') {
        if (_nodes) {
            
            Tone.Transport.bpm.value = 120;
            
            for (let voice of _voices) {
                Tone.Transport.schedule(function(time){
                    playAndUpdateVoiceAndScheduleNextEvent(voice, _nodes!)
                }, 0);
            }
            
            Tone.Transport.start()
        } else {
            console.log(`Error: failed to load _nodes!`);
        }
        
        _state = 'playing'
        d3.select('#play').text('Pause')
    } else if (_state === 'playing') {
        _state = 'paused'
        Tone.Transport.pause();
        d3.select('#play').text('Continue playing')
    } else if (_state === 'paused') {
        _state = 'playing'
        Tone.Transport.start();
        d3.select('#play').text('Pause')
    } else if (_state === 'done') {
        window.location.reload();
    }
}
(window as any).playOrPauseOrRestart = playOrPauseOrRestart;

function playAndUpdateVoiceAndScheduleNextEvent(voice: Voice, nodes: Nodes) {
    let node = voice.getNextNode()
    if (!node) {
        _state_num_completed_voices = _state_num_completed_voices + 1;
        if (_state_num_completed_voices >= _voices.length) {
            _state = 'done'
            d3.select('#play').text('Refresh to play again')
        }
        return;
    }
    let node_id = node.getId();
    let next_node_id = node.selectNextNode()
    if (!next_node_id) {
        _state_num_completed_voices = _state_num_completed_voices + 1;
        if (_state_num_completed_voices >= _voices.length) {
            _state = 'done'
            d3.select('#play').text('Refresh to play again')
        }
        return;
    }
    let next_node = nodes.getNode(next_node_id)
    // Play current node sound, and then update the current node with the next node.
    voice.playAndUpdate(next_node)
    
    // Update node color.
    if (_force_graph && _force_graph.nodes) {
        let target_node = _force_graph.nodes.find(node => node.id === node_id)
        if (target_node) {
            // Recolor node
            target_node.color = voice.getColor();
            target_node.perturbation_color = voice.getColor();
            target_node.perturbation_time = d3.now();
            
            // Bump the note up slightly, and restart simulation.
            if (!target_node.is_rest) {
            let simulation = _force_graph.simulation;
                if (simulation) {
                    let target_node_sim = simulation.nodes().find((d: CustomNode) => d.id === node_id);
                    if (target_node_sim) {
                        target_node_sim.y = target_node_sim.y - (Math.random() * 0.7 + 0.3) * target_node_sim.radius * 10 * Math.pow(1.122, voice.getVolume());
                        target_node_sim.x = target_node_sim.x + Math.random() * 100 - 50;
                    }
                    simulation.alpha(0.3);
                    simulation.restart();
                }
            }
        }
    }
    // Schedule next event.
    Tone.Transport.schedule((time) => {
        playAndUpdateVoiceAndScheduleNextEvent(voice, nodes)
    }, `${voice.getNextNodeTimeInTicks()}i`);
    
    
}

window.addEventListener("load", () => {
    setUp();
    
    if (_markov_config) {
        _force_graph = new ForceGraph('#graph-container', _markov_config);
    }
});
