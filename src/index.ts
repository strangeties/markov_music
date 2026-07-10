import * as d3 from 'd3';
import * as Tone from 'tone';

import { Node } from "./node.ts";
import { Voice } from "./voice.ts";
import { Nodes, getVoices, NodeConfig, VoiceConfig, MarkovConfig } from "./nodes.ts";
import {createForceGraph, CustomNode} from "./visualize.ts";
//import in_c_data from "./in_c.json" with { type: "text" };
import in_c_data from './in_c.json';

let _markov_config: MarkovConfig | null = null
let _nodes: Nodes | null = null
let _voices: Voice[] = []
let _g: any = null

export function setUp() {
    _markov_config = JSON.parse(JSON.stringify(in_c_data)) as MarkovConfig;
    _nodes = new Nodes(_markov_config);
    _voices = getVoices(_markov_config, _nodes);
}

export function playNote() {
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
}
(window as any).playNote = playNote;

function playAndUpdateVoiceAndScheduleNextEvent(voice: Voice, nodes: Nodes) {
    let node = voice.getNextNode()
    if (!node) {
        return;
    }
    let next_node_id = node.selectNextNode()
    if (!next_node_id) {
        return;
    }
    let next_node = nodes.getNode(next_node_id)
    // Play sound.
    voice.playAndUpdate(next_node)
    // Update node color.
    if (_g) {
        let targetNode = _g.selectAll('circle')
                            .filter((d: CustomNode) => d.id === next_node_id);
        // TODO: append, exit, transition, remove instead of just changing the static color.
        targetNode.attr("fill", voice.getColor());
    }
    // Schedule next event.
    Tone.Transport.schedule(function(time){
        playAndUpdateVoiceAndScheduleNextEvent(voice, nodes)
    }, `${voice.getNextNodeTimeInTicks()}i`);
    
    
}

window.addEventListener("load", () => {
    setUp();
    
    if (_markov_config) {
        createForceGraph('#graph-container', _markov_config);
        _g = d3.select("svg").selectAll("g");
    }
});
