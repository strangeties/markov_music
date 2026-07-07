import * as Tone from 'tone';

import { Node } from "./node.ts";
import { Voice } from "./voice.ts";
import { Nodes, getVoices, NodeConfig, VoiceConfig, MarkovConfig } from "./nodes.ts";
import {createForceGraph} from "./visualize.ts";
//import in_c_data from "./in_c.json" with { type: "text" };
import in_c_data from './in_c.json';

let _markov_config: MarkovConfig | null = null
let _nodes: Nodes | null = null
let _voices: Voice[] = []

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
    voice.playAndUpdate(next_node)
    Tone.Transport.schedule(function(time){
        playAndUpdateVoiceAndScheduleNextEvent(voice, nodes)
    }, `${voice.getNextNodeTimeInTicks()}i`);
}

window.addEventListener("load", () => {
    setUp();
    
    if (_markov_config) {
        console.log('calling createForceGraph...');
        createForceGraph('#graph-container', _markov_config);
        console.log('done calling createForceGraph');
    }
});
