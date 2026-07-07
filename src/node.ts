import * as Tone from 'tone';

export class Node {
    public constructor(id: string, note: string | null,
                       note_duration: string,
                       next_node_duration: string) {
        this.id = id;
        this.note = note;
        this.note_duration = Tone.Time(note_duration).toTicks();
        this.next_node_duration = Tone.Time(next_node_duration).toTicks();
    }
    
    public addNextNode(node_id: string, weight: number) {
        if (weight <= 0) {
            throw new Error("weight must be > 0");
        }
        
        this.next_nodes.push([node_id, weight]);
        
        if (this.cumulative_weights.at(-1)) {
            this.cumulative_weights.push(weight + this.cumulative_weights.at(-1)!);
        } else {
            this.cumulative_weights.push(weight);
        }
    }
    
    public clearNextNodes() {
        this.next_nodes = [];
        this.cumulative_weights = [];
    }
    
    public getId(): string {
        return this.id
    }
    
    public getNote(): string | null {
        return this.note
    }
    
    public getNoteDuration(): number {
        return this.note_duration
    }
    
    public getNextNodeDuration(): number {
        return this.next_node_duration;
    }
    
    public getNextNodeIds(): string[] {
        let ids: string[] = []
        for (const [next_node, weight] of this.next_nodes) {
            ids.push(next_node)
        }
        return ids;
    }
    
    public selectNextNode(): string | null {
        let p: number | null = null
        if (this.cumulative_weights.at(-1)) {
            p = Math.random() * this.cumulative_weights.at(-1)!;
        } else {
            return null
        }
        
        let ret = this.next_nodes[0][0]
        for (let i: number = 0; i < this.cumulative_weights.length - 1; i++) {
            if (p < this.cumulative_weights[i]) {
                return ret;
            }
            ret = this.next_nodes[i+1][0]
        }
        return ret;
    }
    
    private id: string;
    // Frequency and duration.
    // A null note indicates a rest.
    // Null durations aren't allowed.
    private note: string | null;
    private note_duration: number;
    private next_node_duration: number;
    // List consists of [index, weight] tuples.
    // Index refers to Node ID.
    // An empty list indicates the end - the Instrument stops.
    private next_nodes: [string, number][] = [];
    private cumulative_weights: number[] = [];
}


