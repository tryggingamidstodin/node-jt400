package nodejt400;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

import org.json.simple.JSONArray;

public class ResultStream {
	private ConnectionProvider connectionProvider;

	private final Connection c;

	private final PreparedStatement st;

	private final ResultSet rs;

	private int columnCount;

	private final int bufferSize;

	private boolean next;

	private boolean init = true;

	private boolean closed = false;

	private String sep = "[";

	public ResultStream(ConnectionProvider connectionProvider, Connection c,
			PreparedStatement st, ResultSet rs, int bufferSize)
			throws Exception {
		this.connectionProvider = connectionProvider;
		this.c = c;
		this.st = st;
		this.rs = rs;
		this.bufferSize = bufferSize;
	}

	public synchronized void close() throws Exception {
		next = false;
		if (closed) {
			return;
		}
		closed = true;
		try {
			try {
				rs.close();
			} finally {
				st.close();
			}
		} finally {
			connectionProvider.returnConnection(c);
		}
	}

	public synchronized String read() throws Exception {
		if (closed) {
			return null;
		}
		if (init) {
			this.columnCount = rs.getMetaData().getColumnCount();
			this.next = rs.next();
			this.init = false;
		}
		if (next) {
			try {
				int i = 0;
				StringBuffer sb = new StringBuffer();
				while (next && i < bufferSize) {
					JSONArray row = new JSONArray();
					for (int j = 1; j <= columnCount; j++) {
						row.add(JdbcJsonClient.trim(rs.getString(j)));
					}
					sb.append(sep);
					sep = ",";
					sb.append(row.toJSONString());
					next = rs.next();
					i++;
				}
				if (!next) {
					sb.append("]");
				}
				return sb.toString();
			} catch (Exception ex) {
				close();
				throw ex;
			}
		}
		close();
		return null;
	}

}
