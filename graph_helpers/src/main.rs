use genpet::GengOption;
fn main() {
    genpet::generate_graphs(5, 5..7, &[GengOption::Connected]).for_each(|g| println!("{:?}", g));
}
