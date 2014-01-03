package nodejt400;

import java.sql.Connection;
import java.sql.DriverManager;

import org.hsqldb.jdbc.JDBCDriver;

public class HsqlClient implements ConnectionProvider
{
	private final JdbcJsonClient client;

	public HsqlClient() throws Exception
	{
		DriverManager.registerDriver(new JDBCDriver());
		client = new JdbcJsonClient(this);
	}

	@Override
	public Connection getConnection() throws Exception
	{
		return DriverManager.getConnection("jdbc:hsqldb:mem:test", "quser", "");
	}

	public String query(String sql, String paramsJson)
			throws Exception
	{
		return client.query(sql, paramsJson);
	}

	public int update(String sql, String paramsJson)
			throws Exception
	{
		return client.update(sql, paramsJson);
	}

	public double insertAndGetId(String sql, String paramsJson)
			throws Exception
	{
		return client.insertAndGetId(sql, paramsJson);
	}

	/**
	 * Mock program call
	 * @param programName
	 * @param paramsSchemaJsonStr
	 * @return
	 */
	public Pgm pgm(String programName, String paramsSchemaJsonStr)
	{
		return new Pgm(programName, paramsSchemaJsonStr);
	}

	public class Pgm
	{
		public Pgm(String programName, String paramsSchemaJsonStr)
		{
		}

		public String run(String paramsJsonStr)
		{
			return paramsJsonStr;
		}
	}
}
