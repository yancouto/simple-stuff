import java.io.*;
import java.util.*;
import java.text.*;

class Dream {
	String title;
	String description;
	String[] labels;
	long date;

	public String toString() {
		return "title: " + title + "\ndesc: " + description + "\nlabel count: " + labels.length + "\ndate: " + date;
	}
}

class LucidityNewDatabase {

	static Random rnd = new Random();

	static String randomString() {
		String dig = "0123456789abcdef";
		StringBuffer s = new StringBuffer();
		for(int i = 0; i < 30; i++)
			s.append(dig.charAt(rnd.nextInt(16)));
		return s.toString();
	}

	static String clean(String s) {
		if(!s.isEmpty() && s.charAt(0) == '"') s = s.substring(1, s.length() - 1);
		if(!s.isEmpty() && s.charAt(0) == '[') s = s.substring(1, s.length() - 1);
		if(!s.isEmpty() && s.charAt(0) == '"') s = s.substring(1, s.length() - 1);
		return s;
	}

	/* File should be separated with ¿ (both rows and columns), and should have the fields (title, dream_entry, labels, date)
	 * They can be extracted from lucidity database with the following commands
	 * .separator ¿ ¿
	 * select title, dream_entry, labels, date from table_dreams inner join table_nights on table_dreams.night_id=table_nights._id;
	 */
	static ArrayList<Dream> getDreams(String filename) throws Exception {
		ArrayList<Dream> al = new ArrayList<>();
		try(Scanner in = new Scanner(new FileInputStream(filename))) {
			in.useDelimiter("¿");
			while(in.hasNext()) {
				Dream d = new Dream();
				d.title = clean(in.next());
				d.description = clean(in.next());
				String lb = clean(in.next());
				if(!lb.isEmpty()) {
					d.labels = lb.split(",");
					for(int i = 0; i < d.labels.length; i++)
						d.labels[i] = clean(d.labels[i]);
				} else d.labels = new String[0];
				d.date = Long.parseLong(in.next());
				al.add(d);
			}
		}
		return al;
	}

	/* File should have a label in each line. Can be generated from lucidity database with
	 * select * from table_labels;
	 */
	static ArrayList<String> getLabels(String filename) throws Exception {
		ArrayList<String> al = new ArrayList<>();
		try(Scanner in = new Scanner(new FileInputStream(filename))) {
			while(in.hasNextLine())
				al.add(in.nextLine());
		}
		return al;
	}

	final static String fileOut = "generated.lucidity";

	public static void main(String[] args) throws Exception {
		PrintStream out = System.out;
		ArrayList<Dream> dreams = getDreams("dream_info");
		ArrayList<String> tags = getLabels("labels_info");
		Map dreamEx = null, tagEx = null; // example dream and tag
		try(ObjectInputStream ois = new ObjectInputStream(new FileInputStream("bk.lucidity"))) { // file with sample stuff
			Object o = ois.readObject();
			ArrayList al = (ArrayList) o;
			for(Object ob : al) {
				Map m = (Map) ob;
				if("dream".equals(m.get("type")) && ((ArrayList) m.get("tags")).isEmpty() && ((int) m.get("realism")) == 0)
					dreamEx = m;
				if("tag".equals(m.get("category")))
					tagEx = m;
			}
		}
		assert(dreamEx != null);
		assert(tagEx != null);

		Map<String, String> tagToId = new HashMap<>();
		ArrayList finalList = new ArrayList();

		for(String t : tags) {
			Map tag = new HashMap(tagEx);
			tagToId.put(t, randomString());
			tag.put("_id", tagToId.get(t));
			tag.put("_rev", randomString());
			tag.put("title", t);
			finalList.add(tag);
			System.out.println(tag);
		}

		for(Dream d : dreams) {
			Map dream = new HashMap(dreamEx);
			dream.put("title", d.title);
			dream.put("description", d.description);
			ArrayList tagList = new ArrayList();
			boolean lucid = false;
			boolean nightmare = false;
			boolean recurrent = false;
			for(String s : d.labels) {
				if("Lucid".equalsIgnoreCase(s))
					lucid = true;
				if("Nightmare".equalsIgnoreCase(s))
					nightmare = true;
				if("Recurrent".equalsIgnoreCase(s))
					recurrent = true;
				tagList.add(tagToId.get(s));
			}
			dream.put("tags", tagList);
			dream.put("isLucid", lucid);
			dream.put("isNightmare", nightmare);
			dream.put("isRecurrent", recurrent);
			dream.put("_rev", randomString());
			dream.put("_id", randomString());
			Date date = new Date(d.date);
			SimpleDateFormat df = new SimpleDateFormat("yyyyMMdd");
			int dt = Integer.parseInt(df.format(date));
			dream.put("date", dt);
			dream.put("dateNegative", dt);
			finalList.add(dream);
			System.out.println(dream);
		}

		try(ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream(fileOut))) {
			oos.writeObject(finalList);
		}
	}
}
