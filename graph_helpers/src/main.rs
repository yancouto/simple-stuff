use genpet::GengOption;

mod graph_ext;

use graph_ext::Graph;

fn main() {
    genpet::generate_graphs(12, .., &[GengOption::Connected])
        .expect("Failed to execute geng")
        .for_each(|g| {
            let g: Graph = g.into();
            println!("{:?}", g.min_degree());
            g.print_edges();
        });
}
