import * as Tone from 'tone';

import { Node } from "./node.ts";


export class Voice {
    public constructor(node: Node, transpose_8va: number) {
        this.next_node = node;
        this.next_node_time_in_ticks = 0;
        
        this.instrument = new Tone.Synth().toDestination();
        this.transpose_8va = transpose_8va
    }
    
    public playAndUpdate(node: Node | null) {
        let next_node = this.next_node
        if (next_node) {
            let note = next_node.getNote()
            if (note) {
                let f = Tone.Frequency(note).transpose(this.transpose_8va * 12).toNote()
                this.instrument.triggerAttackRelease(f, `${next_node.getNoteDuration()}i`);
            }
            this.next_node_time_in_ticks = this.next_node_time_in_ticks + next_node.getNextNodeDuration();
            this.next_node = node;
        } else {
            this.next_node = null;
        }
    }
    
    public getNextNode() : Node | null {
        return this.next_node;
    }
    
    public getNextNodeTimeInTicks() : number {
        return this.next_node_time_in_ticks;
    }
    
    private next_node: Node | null;
    private next_node_time_in_ticks: number;
    
    private instrument: Tone.Synth;
    private transpose_8va: number;
}
