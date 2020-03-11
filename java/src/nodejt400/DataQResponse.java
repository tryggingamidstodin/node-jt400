package nodejt400;

public class DataQResponse {
	private String data;
	private DataQ DataQ;

	public DataQResponse(String data, DataQ DataQ) {
		super();
		this.data = data;
		this.DataQ = DataQ;
	}

	public String getData() {
		return data;
	}

	public void write(String data) throws Exception {
		DataQ.write(data);
	}

}
