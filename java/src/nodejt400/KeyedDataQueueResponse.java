package nodejt400;

public class KeyedDataQueueResponse {
	private String writeKey;
	private String data;
	private KeyedDataQ dataQ;

	public KeyedDataQueueResponse(String writeKey, String data, KeyedDataQ dataQ) {
		super();
		this.writeKey = writeKey;
		this.data = data;
		this.dataQ = dataQ;
	}

	public String getData() {
		return data;
	}

	public void write(String data) throws Exception {
		dataQ.write(writeKey, data);
	}

}
