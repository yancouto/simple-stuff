import java.io.*;
import java.util.*;
import java.util.stream.Collectors;
import java.text.*;

class Dream {
	String title;
	String description;
	ArrayList labels;
	// 0..10
	int lucidity;
	boolean nightmare;
	int date;

	public static Dream maybeParse(Map m) {
		if (!"dream".equals(m.get("type"))) {
			return null;
		}
		Dream d = new Dream();
		d.title = (String) m.get("title");
		d.description = (String) m.get("description");
		d.labels = (ArrayList) m.get("tags");
		d.labels.addAll((ArrayList) m.get("characters"));
		d.labels.addAll((ArrayList) m.get("places"));
		d.labels.addAll((ArrayList) m.get("emotions"));
		d.labels.addAll((ArrayList) m.get("techniques"));
		d.lucidity = (int) m.get("lucidity");
		if (d.lucidity == 0 && (boolean) m.get("isLucid"))
			d.lucidity = 5;
		d.nightmare = (boolean) m.get("isNightmare");
		d.date = (int) m.get("date");
		return d;
	}

	public String toString() {
		return "title: " + title + "\ndesc: " + description + "\nlabel count: " + labels.size() + "\ndate: " + date;
	}
}

class Tag {
	String title;
	String key;
	String category;

	public static Tag maybeParse(Map m) {
		Tag t = new Tag();
		t.title = (String) m.get("title");
		t.key = (String) m.get("_id");
		t.category = (String) m.get("category");
		return t;
	}
}

class FinalDream {
	String title;
	String description;
	int date;
	// 0..100
	int lucidity;
	boolean nightmare;
	ArrayList<String> tags;
	ArrayList<String> pessoas;
	ArrayList<String> feelings;
	ArrayList<String> lugar;

	public static FinalDream convert(Dream d, Map<String, Tag> tags) throws Exception {
		FinalDream fd = new FinalDream();
		fd.title = d.title;
		fd.description = d.description;
		fd.lucidity = d.lucidity * 10;
		fd.nightmare = d.nightmare;
		fd.date = d.date;
		fd.tags = new ArrayList<>();
		fd.pessoas = new ArrayList<>();
		fd.feelings = new ArrayList<>();
		fd.lugar = new ArrayList<>();
		for (Object key : d.labels) {
			Tag t = tags.get((String) key);
			if (t == null) {
				if ("cc9e812a761cdcf17d267811896d65".equals(key)) {
					// This tag doesn't really exist, it is a bug in my db
					continue;
				}
				continue;
			}
			switch (t.category) {
				case "tag":
					fd.tags.add(t.title);
					break;
				case "character":
					fd.pessoas.add(t.title);
					break;
				case "emotion":
					fd.feelings.add(t.title);
					break;
				case "place":
					fd.lugar.add(t.title);
					break;
				default:
					throw new Exception();
			}
		}
		return fd;
	}

	private static String encode(String s) {
		return Base64.getEncoder().encodeToString(s.getBytes());
	}

	public void dumpCsv() {
		System.out.print(
				FinalDream.encode(title) + "," + FinalDream.encode(description) + "," + date + "," + lucidity + ","
						+ (nightmare ? 1 : 0) + ",");
		String tags = this.tags.stream().collect(Collectors.joining("|"));
		String pessoas = this.pessoas.stream().collect(Collectors.joining("|"));
		String feelings = this.feelings.stream().collect(Collectors.joining("|"));
		String lugar = this.lugar.stream().collect(Collectors.joining("|"));
		System.out.println(FinalDream.encode(tags) + "," + FinalDream.encode(pessoas) + ","
				+ FinalDream.encode(feelings) + "," + FinalDream.encode(lugar));
	}
}

class LucidityToCsv {
	public static void main(String[] args) throws Exception {
		String file = args[0];
		ArrayList<Dream> dreams = new ArrayList<>();
		Map<String, Tag> tags = new HashMap<>();
		try (ObjectInputStream ois = new ObjectInputStream(new FileInputStream(file))) {
			Object o = ois.readObject();
			ArrayList al = (ArrayList) o;
			for (Object el : al) {
				Map map = (Map) el;
				Dream d = Dream.maybeParse(map);
				if (d != null) {
					dreams.add(d);
				} else {
					Tag t = Tag.maybeParse(map);
					tags.put(t.key, t);
				}
			}
		}
		for (Dream old_dream : dreams) {
			FinalDream d = FinalDream.convert(old_dream, tags);
			d.dumpCsv();
		}
	}
}