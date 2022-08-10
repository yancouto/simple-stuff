use regex::*;
use std::collections::*;
use clap::Parser;

#[derive(Default)]
struct Graph {
    edges: HashMap<String, Vec<String>>,
}

fn dfs(g: &Graph, seen: &mut HashSet<String>, from: String, to: &String) -> bool {
    if from == *to {
        return true;
    }
    if !seen.insert(from.clone()) {
        return false;
    }
    for nx in g.edges.get(&from).cloned().unwrap_or_default() {
        if dfs(g, seen, nx, to) {
            return true;
        }
    }
    return false;
}

fn can_impl(g: &Graph, a: String, b: String) -> bool {
    let mut seen = HashSet::new();
    dfs(g, &mut seen, a, &b)
}

fn can(g: &Graph, cache: &mut HashMap<(String, String), bool>, a: String, b: String) -> bool {
    *cache.entry((a.clone(), b.clone())).or_insert_with(move || can_impl(g, a, b))
}

#[derive(Clone, clap::ValueEnum)]
enum Mode {
    OnlyCycles,
    All,
}


#[derive(Parser)]
struct Args {
    input: String,
    #[clap(long, value_enum, default_value_t = Mode::OnlyCycles)]
    mode: Mode,
}

fn main() {
    let args = Args::parse();
    let mut all = HashMap::new();
    let mut name = |orig: String| -> String {
        let l = all.len();
        all.entry(orig).or_insert_with(|| format!("a{}", l)).clone()
    };
    let r = Regex::new("\"(.+)\" eh melhor que \"(.+)\"?\\n\\n(.)").unwrap();
    let text = std::fs::read_to_string(args.input).unwrap();
    let mut cache = HashMap::new();
    let mut g = Graph::default();
    println!("digraph G {{");
    for c in r.captures_iter(&text) {
        let mut a = name(c[1].to_string());
        let mut b = name((&c[2][..c[2].len()-2]).to_string());
        if matches!(args.mode, Mode::All) {
            println!("{} -> {}", a, b);
        }
        let ans = &c[3] == "s";
        if !ans {
            std::mem::swap(&mut a, &mut b);
        }
        g.edges.entry(a).or_default().push(b);
    }
    let mut seen = HashSet::new();
    if matches!(args.mode, Mode::OnlyCycles) {
        for (a, edges) in &g.edges {
            for b in edges {
                if can(&g, &mut cache, b.clone(), a.clone()) {
                    println!("{} -> {}", a, b);
                    seen.insert(a);
                    seen.insert(b);
                }
            }
        }
    }
    println!("node []");
    for (orig, new) in all {
        if matches!(args.mode, Mode::All) || seen.contains(&new) {
            println!("{} [label=\"{}\"]", new, orig);
        }
    }
    println!("}}");
}
