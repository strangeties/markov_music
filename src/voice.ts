import * as Tone from 'tone';

import { Node } from "./node.ts";


export class Voice {
    public constructor(node: Node,
                       transpose_8va: number | null,
                       oscillator: Tone.ToneOscillatorType | null,
                       sustain_volume: number | null,
                       lpf_cutoff_hz: number | null,
                       ping_pong_delay_time: string | null,
                       chorus_depth: number | null,
                       pan: number | null,
                       volume: number | null) {
        this.next_node = node;
        this.next_node_time_in_ticks = 0;
        
        this.instrument = new Tone.Synth();
        this.filters = []
        if (oscillator) {
            this.instrument.oscillator.type = oscillator;
        }
        if (lpf_cutoff_hz) {
            const filter = new Tone.Filter({
                type: 'lowpass',
                frequency: lpf_cutoff_hz,
            })
            this.filters.push(filter)
        }
        if (ping_pong_delay_time) {
            const effect = new Tone.PingPongDelay(ping_pong_delay_time, 0.12);
            this.filters.push(effect);
        }
        if (chorus_depth) {
            const effect = new Tone.Chorus({ depth: chorus_depth });
            this.filters.push(effect);
        }
        if (pan || volume) {
            let p = 0
            let v = 0
            if (pan) {
                p = pan
            }
            if (volume) {
                v = volume
            }
            const effect = new Tone.PanVol(p, v);
            this.filters.push(effect)
        }
        this.instrument.chain(...this.filters, Tone.Destination);
        this.transpose_8va = transpose_8va;
    }
    
    public playAndUpdate(node: Node | null) {
        let next_node = this.next_node;
        if (next_node) {
            let note = next_node.getNote()
            if (note) {
                let transpose_8va = 0;
                if (this.transpose_8va) {
                    transpose_8va = this.transpose_8va;
                }
                let f = Tone.Frequency(note).transpose(transpose_8va * 12).toNote()
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
    private filters: any[];
    private transpose_8va: number | null;
}
